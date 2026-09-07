/** Durable Prompt Profile selection projection. */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import { z } from 'zod'
import type {
  EffectivePromptProfile,
  PromptProfileProjection,
  PromptProfileProjectionState,
  PromptProfileSelection,
} from './types.ts'

const effectiveSchema = z.object({
  id: z.string().min(1),
  revision: z.string().min(1),
  source: z.enum(['auto', 'manual']),
}) as unknown as z.ZodType<EffectivePromptProfile>

const selectionSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('auto') }),
  z.object({
    mode: z.literal('manual'),
    profileId: z.string().min(1),
    revision: z.string().min(1),
  }),
]) as unknown as z.ZodType<PromptProfileSelection>

const stateSchema = z.object({
  lastUsed: effectiveSchema.nullable(),
  pending: selectionSchema.nullable(),
}) as unknown as z.ZodType<PromptProfileProjectionState>

const viewSchema = z.object({
  lastUsed: effectiveSchema.nullable(),
  next: selectionSchema,
}) as unknown as z.ZodType<PromptProfileProjection>

/** Compare two explicit selection intents. */
export function samePromptProfileSelection(
  left: PromptProfileSelection,
  right: PromptProfileSelection,
): boolean {
  if (left.mode !== right.mode) return false
  if (left.mode === 'auto' || right.mode === 'auto') return true
  return left.profileId === right.profileId && left.revision === right.revision
}

/** Recover the selection intent represented by one effective request value. */
export function selectionFromEffective(value: EffectivePromptProfile): PromptProfileSelection {
  return value.source === 'auto'
    ? { mode: 'auto' }
    : { mode: 'manual', profileId: value.id, revision: value.revision }
}

function consumed(selection: PromptProfileSelection, effective: EffectivePromptProfile): boolean {
  if (selection.mode === 'auto') return effective.source === 'auto'
  return effective.source === 'manual'
    && selection.profileId === effective.id
    && selection.revision === effective.revision
}

/** Fold one selection or request-header event into Prompt Profile state. */
export function applyPromptProfileProjection(
  state: PromptProfileProjectionState,
  event: SessionEvent,
): PromptProfileProjectionState {
  if (event.type === 'prompt-profile/selection') {
    const current = state.pending ?? (state.lastUsed === null
      ? { mode: 'auto' as const }
      : selectionFromEffective(state.lastUsed))
    return samePromptProfileSelection(current, event.data)
      ? state
      : { lastUsed: state.lastUsed, pending: event.data }
  }
  if (event.type !== 'request/header') return state
  const effective = event.data.header.metadata?.promptProfile
  if (effective === undefined) return state
  const pending = state.pending !== null && consumed(state.pending, effective)
    ? null
    : state.pending
  if (state.lastUsed?.id === effective.id
    && state.lastUsed.revision === effective.revision
    && state.lastUsed.source === effective.source
    && pending === state.pending) return state
  return { lastUsed: effective, pending }
}

const promptProfileProjection = {
  key: 'promptProfileSelection',
  stateSchema,
  init: () => ({ lastUsed: null, pending: null }),
  apply: applyPromptProfileProjection,
  wire: {
    viewSchema,
    view: (state): PromptProfileProjection => ({
      lastUsed: state.lastUsed,
      next: state.pending ?? (state.lastUsed === null
        ? { mode: 'auto' }
        : selectionFromEffective(state.lastUsed)),
    }),
  },
  stateVersion: 1,
} satisfies ProjectionDefinition<'promptProfileSelection', PromptProfileProjectionState>

/** Register the Prompt Profile projection on the shared registry. */
export function installPromptProfileProjection(ctx: Context): void {
  ctx.effect(() => ctx.sessionProjections.register(promptProfileProjection), 'prompt-profiles projection')
}
