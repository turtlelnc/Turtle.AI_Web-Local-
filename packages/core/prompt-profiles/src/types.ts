/** Browser-safe Prompt Profile definitions, selections, and projections. */

import type { Branded } from '@deepseek-ai/dsh-brand'

/** Stable identity of one built-in or custom Prompt Profile. */
export type PromptProfileId = Branded<'PromptProfileId'>

/** Immutable revision identity of one Prompt Profile definition. */
export type PromptProfileRevision = Branded<'PromptProfileRevision'>

/** Built-in behavior family inherited by a Prompt Profile. */
export type PromptProfileBase = 'codex' | 'deepseek-harness'

/** User-adjustable stylistic policy that cannot replace runtime safety instructions. */
export interface PromptProfileBehavior {
  readonly progressUpdates: 'inherit' | 'concise' | 'off'
  readonly responseDetail: 'inherit' | 'concise' | 'balanced' | 'detailed'
}

/** Versioned behavior definition selected independently from a model provider. */
export interface PromptProfileDefinition {
  readonly id: PromptProfileId
  readonly name: string
  readonly base: PromptProfileBase
  readonly additionalInstructions: string
  readonly behavior: PromptProfileBehavior
  readonly revision: PromptProfileRevision
  readonly builtIn: boolean
}

/** Session-owned selection; Auto is resolved against the provider at request assembly. */
export type PromptProfileSelection =
  | { readonly mode: 'auto' }
  | {
    readonly mode: 'manual'
    readonly profileId: PromptProfileId
    readonly revision: PromptProfileRevision
  }

/** Exact Prompt Profile used for one durable model request. */
export interface EffectivePromptProfile {
  readonly id: PromptProfileId
  readonly revision: PromptProfileRevision
  readonly source: 'auto' | 'manual'
}

/** Mutable fields accepted when creating or revising a custom Prompt Profile. */
export interface PromptProfileDraft {
  readonly id?: string
  readonly name: string
  readonly base: PromptProfileBase
  readonly additionalInstructions: string
  readonly behavior: PromptProfileBehavior
}

/** One ordered Auto-resolution rule; the final wildcard rule is the fallback. */
export interface PromptProfileDefaultRule {
  readonly providers: readonly string[] | '*'
  readonly profileId: PromptProfileId
}

/** Host fold state for durable Prompt Profile selection. */
export interface PromptProfileProjectionState {
  readonly lastUsed: EffectivePromptProfile | null
  readonly pending: PromptProfileSelection | null
}

/** Client view of the durable Prompt Profile selection fold. */
export interface PromptProfileProjection {
  readonly lastUsed: EffectivePromptProfile | null
  readonly next: PromptProfileSelection
}

declare module '@deepseek-ai/dsh-system-prompt' {
  interface PromptAssemblyMetadataMap {
    /** Exact Prompt Profile applied to this assembly. */
    promptProfile: EffectivePromptProfile
  }
}

declare module '@deepseek-ai/dsh-session/types' {
  interface RequestHeaderMetadataMap {
    /** Exact Prompt Profile applied to this request. */
    promptProfile: EffectivePromptProfile
  }

  interface SessionEventMap {
    /**
     * Selects Auto or one immutable Prompt Profile revision for a later request.
     * @param mode - Auto or manual resolution policy.
     */
    'prompt-profile/selection': PromptProfileSelection
  }
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    /** Durable Prompt Profile selection consumed by request headers. */
    promptProfileSelection: PromptProfileProjectionState
  }

  interface SessionProjectionMap {
    /** Prompt Profile used by the latest request and selected for the next one. */
    promptProfileSelection: PromptProfileProjection
  }
}
