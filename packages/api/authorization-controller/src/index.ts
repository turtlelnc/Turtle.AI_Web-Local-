/** Secret-free Remote owner for interactive authorization flows. */

import { randomUUID } from 'node:crypto'
import { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import { AuthorizationDeclinedError } from '@deepseek-ai/dsh-authorization'
import type { AuthorizationPrompt } from '@deepseek-ai/dsh-authorization/types'
import { parseCredentialKey } from '@deepseek-ai/dsh-credentials'
import type { CredentialKey } from '@deepseek-ai/dsh-credentials/types'
import { Deque } from '@deepseek-ai/dsh-deque'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {
  AuthorizationActionValue,
  AuthorizationAttemptId,
  AuthorizationAttemptSnapshot,
  AuthorizationBeginRequest,
  AuthorizationBeginValue,
  AuthorizationCancelRequest,
  AuthorizationListValue,
  AuthorizationLogoutRequest,
  AuthorizationRespondRequest,
  AuthorizationWatchFrame,
  AuthorizationWatchRequest,
  AuthorizationWirePrompt,
} from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Remote owner for authorization flows and their interaction state. */
    authorizationController: AuthorizationController
  }
}

interface PendingPrompt {
  readonly id: string
  readonly resolve: (answer: string) => void
  readonly reject: (error: Error) => void
  readonly dispose: () => void
}

interface Attempt {
  snapshot: AuthorizationAttemptSnapshot
  readonly controller: AbortController
  prompt?: PendingPrompt
  readonly watchers: Set<AttemptQueue>
}

/** Host service backing the generated `ctx.remote.authorization` namespace. */
export class AuthorizationController extends TypertRemoteService {
  static inject = ['authorization', 'credentials', 'typert']

  private readonly attempts = new Map<AuthorizationAttemptId, Attempt>()

  /** @param ctx - Host context carrying authorization and credential seams. */
  constructor(ctx: Context) {
    super(ctx, 'authorizationController', { namespace: 'authorization' })
    ctx.effect(() => () => {
      for (const attempt of this.attempts.values()) {
        attempt.controller.abort()
        attempt.prompt?.reject(new AuthorizationDeclinedError('authorization controller stopped'))
        for (const watcher of attempt.watchers) watcher.end()
      }
      this.attempts.clear()
    }, 'authorization-controller attempts')
  }

  /**
   * List registered flows and redacted configured status.
   * @returns registered authorization flows with secret-free configuration state.
   */
  @Remote('list')
  async list(): Promise<AuthorizationListValue> {
    return {
      entries: await Promise.all(this.ctx.authorization.list().map(async entry => ({
        ...entry,
        configured: (await this.ctx.credentials.describeRecord(entry.key)).configured,
      }))),
    }
  }

  /**
   * Start a Host-owned attempt and return without waiting for login completion.
   * @param request - authorization flow and optional login method to start.
   * @returns the opaque identity of the newly started attempt.
   */
  @Remote('begin')
  begin(request: AuthorizationBeginRequest): AuthorizationBeginValue {
    const key = this.key(request.key)
    const flow = this.ctx.authorization.describe(key)
    if (flow === undefined) throw new RemoteError('authorization/not-found', `authorization flow "${key}" not found`, {})
    if (flow.inFlight) throw new RemoteError('authorization/conflict', `authorization flow "${key}" is already running`, {})
    if (request.method !== undefined && !flow.methods.some(method => method.id === request.method)) {
      throw new RemoteError('gateway/bad-request', `authorization method "${request.method}" not found`, {})
    }
    const attemptId = brandString<AuthorizationAttemptId>(`authorization-${randomUUID()}`)
    const attempt: Attempt = {
      snapshot: {
        attemptId,
        key,
        status: 'running',
        ...(request.method === undefined ? {} : { method: request.method }),
      },
      controller: new AbortController(),
      watchers: new Set(),
    }
    this.attempts.set(attemptId, attempt)
    this.trimAttempts()
    void this.run(attempt)
    return { attemptId }
  }

  /**
   * Answer the exact currently pending prompt.
   * @param request - attempt, prompt identity, and user-provided answer.
   * @returns whether the pending prompt was changed.
   */
  @Remote('respond')
  respond(request: AuthorizationRespondRequest): AuthorizationActionValue {
    const attempt = this.attempt(request.attemptId)
    if (attempt.snapshot.status !== 'running' || attempt.prompt?.id !== request.promptId) {
      throw new RemoteError('authorization/conflict', 'authorization prompt is no longer pending', {})
    }
    const pending = attempt.prompt
    delete attempt.prompt
    pending.dispose()
    this.publish(attempt, this.withoutPrompt(attempt.snapshot))
    pending.resolve(request.answer)
    return { changed: true }
  }

  /**
   * Cancel one running attempt.
   * @param request - identity of the authorization attempt to cancel.
   * @returns whether a running attempt was changed.
   */
  @Remote('cancel')
  cancel(request: AuthorizationCancelRequest): AuthorizationActionValue {
    const attempt = this.attempt(request.attemptId)
    if (attempt.snapshot.status !== 'running') return { changed: false }
    attempt.controller.abort()
    return { changed: true }
  }

  /**
   * Stream a reconnect baseline followed by attempt replacements.
   * @param request - identity of the authorization attempt to observe.
   * @param signal - cancellation signal for the remote stream.
   * @returns attempt snapshots beginning with a reconnect baseline.
   */
  @Remote({ mode: 'stream' })
  async *watch(request: AuthorizationWatchRequest, signal: AbortSignal): AsyncIterable<AuthorizationWatchFrame> {
    signal.throwIfAborted()
    const attempt = this.attempt(request.attemptId)
    const queue = new AttemptQueue()
    attempt.watchers.add(queue)
    try {
      yield { type: 'baseline', value: attempt.snapshot }
      yield* queue.iterate(signal)
    } finally {
      attempt.watchers.delete(queue)
      queue.end()
    }
  }

  /**
   * Remove a stored grant without returning its payload.
   * @param request - authorization flow whose stored grant should be removed.
   * @returns whether a configured grant was removed.
   */
  @Remote('logout')
  async logout(request: AuthorizationLogoutRequest): Promise<AuthorizationActionValue> {
    const key = this.key(request.key)
    const before = await this.ctx.credentials.describeRecord(key)
    if (!before.configured) return { changed: false }
    this.ctx.authorization.cancel(key)
    await this.ctx.credentials.deleteRecord(key)
    return { changed: true }
  }

  private async run(attempt: Attempt): Promise<void> {
    try {
      const outcome = await this.ctx.authorization.begin({
        key: attempt.snapshot.key,
        ...(attempt.snapshot.method === undefined ? {} : { method: attempt.snapshot.method }),
        signal: attempt.controller.signal,
        interaction: {
          notify: (notice) => { this.publish(attempt, { ...attempt.snapshot, notice }) },
          prompt: prompt => this.prompt(attempt, prompt),
        },
      })
      this.finish(attempt, outcome.status)
    } catch (error) {
      if (attempt.controller.signal.aborted) this.finish(attempt, 'cancelled')
      else this.finish(attempt, 'failed', error instanceof Error ? error.message : String(error))
    }
  }

  private prompt(attempt: Attempt, prompt: AuthorizationPrompt): Promise<string> {
    if (attempt.prompt !== undefined) return Promise.reject(new Error('authorization flow opened overlapping prompts'))
    const id = randomUUID()
    const wire = { ...prompt } as Record<string, unknown>
    delete wire.signal
    return new Promise<string>((resolve, reject) => {
      const decline = (): void => { reject(new AuthorizationDeclinedError()) }
      prompt.signal?.addEventListener('abort', decline, { once: true })
      attempt.prompt = {
        id,
        resolve,
        reject,
        dispose: () => { prompt.signal?.removeEventListener('abort', decline) },
      }
      this.publish(attempt, {
        ...attempt.snapshot,
        prompt: wire as AuthorizationWirePrompt,
        promptId: id,
      })
    })
  }

  private finish(attempt: Attempt, status: 'authorized' | 'cancelled' | 'failed', error?: string): void {
    attempt.prompt?.dispose()
    attempt.prompt?.reject(new AuthorizationDeclinedError('authorization attempt ended'))
    delete attempt.prompt
    this.publish(attempt, {
      ...this.withoutPrompt(attempt.snapshot),
      status,
      ...(error === undefined ? {} : { error }),
    })
    for (const watcher of attempt.watchers) watcher.end()
  }

  private publish(attempt: Attempt, snapshot: AuthorizationAttemptSnapshot): void {
    attempt.snapshot = snapshot
    for (const watcher of attempt.watchers) watcher.push({ type: 'changed', value: snapshot })
  }

  private withoutPrompt(snapshot: AuthorizationAttemptSnapshot): AuthorizationAttemptSnapshot {
    const { prompt: _prompt, promptId: _promptId, ...rest } = snapshot
    return rest
  }

  private attempt(id: AuthorizationAttemptId): Attempt {
    const attempt = this.attempts.get(id)
    if (attempt === undefined) {
      throw new RemoteError('authorization/not-found', `authorization attempt "${id}" not found`, {})
    }
    return attempt
  }

  private key(value: CredentialKey): CredentialKey {
    try {
      return parseCredentialKey(value)
    } catch (error) {
      throw new RemoteError('gateway/bad-request', error instanceof Error ? error.message : String(error), {})
    }
  }

  private trimAttempts(): void {
    if (this.attempts.size <= 20) return
    for (const [id, attempt] of this.attempts) {
      if (attempt.snapshot.status === 'running') continue
      this.attempts.delete(id)
      if (this.attempts.size <= 20) return
    }
  }
}

class AttemptQueue {
  private readonly values = new Deque<AuthorizationWatchFrame>()
  private waiter: (() => void) | undefined
  private done = false

  push(value: AuthorizationWatchFrame): void {
    if (this.done) return
    this.values.pushBack(value)
    this.waiter?.()
  }

  end(): void {
    this.done = true
    this.waiter?.()
  }

  async *iterate(signal: AbortSignal): AsyncIterable<AuthorizationWatchFrame> {
    const abort = (): void => { this.end() }
    signal.addEventListener('abort', abort, { once: true })
    try {
      while (true) {
        while (this.values.size > 0) yield this.values.popFront() as AuthorizationWatchFrame
        if (this.done || signal.aborted) return
        await new Promise<void>((resolve) => { this.waiter = resolve })
        this.waiter = undefined
      }
    } finally {
      signal.removeEventListener('abort', abort)
    }
  }
}

export default AuthorizationController
