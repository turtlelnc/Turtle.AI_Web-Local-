/** Browser-safe request and event vocabulary for interactive authorization. */

import type { Branded } from '@deepseek-ai/dsh-brand'
import type { AuthorizationEntry, AuthorizationNotice, AuthorizationPrompt } from '@deepseek-ai/dsh-authorization/types'
import type { CredentialKey } from '@deepseek-ai/dsh-credentials/types'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** Requested authorization flow or attempt does not exist. */
    'authorization/not-found': {}
    /** Authorization state changed before the requested action could apply. */
    'authorization/conflict': {}
  }
}

/** Opaque identity of one Host-owned authorization attempt. */
export type AuthorizationAttemptId = Branded<'AuthorizationAttemptId'>

/** Secret-free authorization entry with durable configuration status. */
export interface AuthorizationListEntry extends AuthorizationEntry {
  /** Whether the flow's credential record is currently configured. */
  readonly configured: boolean
}

/** Result of listing available interactive authorization flows. */
export interface AuthorizationListValue {
  /** Flows in Host registration order. */
  readonly entries: readonly AuthorizationListEntry[]
}

/** Starts one interactive authorization attempt. */
export interface AuthorizationBeginRequest {
  /** Credential record owned by the selected flow. */
  readonly key: CredentialKey
  /** Flow method; omission selects the flow's preferred method. */
  readonly method?: string
}

/** Handle returned before interactive authorization completes. */
export interface AuthorizationBeginValue {
  /** Attempt to watch, answer, or cancel. */
  readonly attemptId: AuthorizationAttemptId
}

/** Selects one attempt for a watch stream. */
export interface AuthorizationWatchRequest {
  /** Attempt returned by `authorization.begin`. */
  readonly attemptId: AuthorizationAttemptId
}

/** Answers the currently pending non-secret or secret prompt. */
export interface AuthorizationRespondRequest {
  /** Attempt returned by `authorization.begin`. */
  readonly attemptId: AuthorizationAttemptId
  /** Prompt identity from the latest watch frame. */
  readonly promptId: string
  /** User answer; transported only to the waiting Host callback. */
  readonly answer: string
}

/** Cancels one attempt. */
export interface AuthorizationCancelRequest {
  /** Attempt returned by `authorization.begin`. */
  readonly attemptId: AuthorizationAttemptId
}

/** Removes one stored authorization grant. */
export interface AuthorizationLogoutRequest {
  /** Credential record to remove. */
  readonly key: CredentialKey
}

/** Acknowledgement for respond, cancel, and logout operations. */
export interface AuthorizationActionValue {
  /** Whether this call changed live or durable state. */
  readonly changed: boolean
}

/** Public state of one authorization attempt. */
export type AuthorizationAttemptStatus = 'running' | 'authorized' | 'cancelled' | 'failed'

/** Complete reconnect baseline for one attempt. */
export interface AuthorizationAttemptSnapshot {
  /** Attempt identity. */
  readonly attemptId: AuthorizationAttemptId
  /** Credential record being authorized. */
  readonly key: CredentialKey
  /** Selected flow method. */
  readonly method?: string
  /** Current terminal or running status. */
  readonly status: AuthorizationAttemptStatus
  /** Most recent safe-to-display notice. */
  readonly notice?: AuthorizationNotice
  /** Current question, with AbortSignal removed for the wire. */
  readonly prompt?: AuthorizationWirePrompt
  /** Stable prompt identity required by `respond`. */
  readonly promptId?: string
  /** Safe failure message; never includes credential payloads. */
  readonly error?: string
}

/** Authorization prompt after removing Host-only cancellation state. */
export type AuthorizationWirePrompt = AuthorizationPrompt extends infer Prompt
  ? Prompt extends unknown ? Omit<Prompt, 'signal'> : never
  : never

/** Baseline or replacement item emitted by `authorization.watch`. */
export type AuthorizationWatchFrame =
  | { readonly type: 'baseline'; readonly value: AuthorizationAttemptSnapshot }
  | { readonly type: 'changed'; readonly value: AuthorizationAttemptSnapshot }
