import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import AuthorizationService from '@deepseek-ai/dsh-authorization'
import { credentialKey } from '@deepseek-ai/dsh-credentials'
import AuthorizationController from '../src/index.ts'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import { MemoryCredentials } from '../../../credentials/credentials/tests/memory.ts'

const KEY = credentialKey('llm-pi-ai', 'openai-codex')

async function boot(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(MemoryCredentials)
  await ctx.plugin(AuthorizationService)
  await ctx.plugin(TypertRegistry)
  await ctx.plugin(AuthorizationController)
  return ctx
}

describe('authorization Remote controller', () => {
  it('lists configuration state without exposing stored payloads', async () => {
    const ctx = await boot()
    await ctx.credentials.modifyRecord(KEY, () => Promise.resolve({
      kind: 'grant', payload: { access: 'secret-access-token' },
    }))
    ctx.authorization.registerFlow({
      key: KEY,
      label: 'ChatGPT / Codex',
      methods: [{ id: 'oauth', label: 'Sign in' }],
      run: () => Promise.resolve(),
    })

    const listed = await ctx.authorizationController.list()
    expect(listed.entries).toEqual([{
      key: KEY,
      label: 'ChatGPT / Codex',
      methods: [{ id: 'oauth', label: 'Sign in' }],
      inFlight: false,
      configured: true,
    }])
    expect(JSON.stringify(listed)).not.toContain('secret-access-token')
  })

  it('relays prompts, accepts the matching response, and ends authorized', async () => {
    const ctx = await boot()
    ctx.authorization.registerFlow({
      key: KEY,
      label: 'ChatGPT / Codex',
      methods: [{ id: 'oauth', label: 'Sign in' }],
      async run(session) {
        const answer = await session.prompt({ kind: 'text', message: 'Paste the returned code' })
        await ctx.credentials.modifyRecord(KEY, () => Promise.resolve({
          kind: 'grant', payload: { code: answer },
        }))
      },
    })

    const { attemptId } = ctx.authorizationController.begin({ key: KEY, method: 'oauth' })
    const signal = new AbortController()
    let promptId: string | undefined
    let terminal: string | undefined
    for await (const frame of ctx.authorizationController.watch({ attemptId }, signal.signal)) {
      if (frame.value.promptId !== undefined && promptId === undefined) {
        promptId = frame.value.promptId
        expect(frame.value.prompt).toMatchObject({ kind: 'text', message: 'Paste the returned code' })
        expect(ctx.authorizationController.respond({ attemptId, promptId, answer: 'one-time-code' }))
          .toEqual({ changed: true })
      }
      if (frame.value.status !== 'running') terminal = frame.value.status
    }
    expect(promptId).toBeDefined()
    expect(terminal).toBe('authorized')
  })
})
