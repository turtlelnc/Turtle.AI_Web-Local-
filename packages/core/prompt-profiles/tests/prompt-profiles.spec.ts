import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { brandString } from '@deepseek-ai/dsh-brand'
import {
  CODEX_PROMPT_PROFILE_ID,
  HARNESS_PROMPT_PROFILE_ID,
  defaultPromptProfileId,
} from '../src/index.ts'
import { applyPromptProfileProjection } from '../src/projection.ts'
import type {
  PromptProfileId,
  PromptProfileProjectionState,
  PromptProfileRevision,
} from '../src/types.ts'

const initial: PromptProfileProjectionState = { lastUsed: null, pending: null }

function event(value: unknown): SessionEvent {
  return value as SessionEvent
}

describe('Prompt Profile Auto resolver', () => {
  it.each(['chatgpt-codex', 'openai', 'openai-codex'])(
    'maps official route %s to Codex',
    (provider) => { expect(defaultPromptProfileId(provider)).toBe(CODEX_PROMPT_PROFILE_ID) },
  )

  it.each(['deepseek', 'deepseek-official', 'custom-gateway', 'unknown'])(
    'maps third-party route %s to DeepSeek Harness',
    (provider) => { expect(defaultPromptProfileId(provider)).toBe(HARNESS_PROMPT_PROFILE_ID) },
  )
})

describe('Prompt Profile session projection', () => {
  it('treats an old session with no profile event as Auto', () => {
    expect(initial).toEqual({ lastUsed: null, pending: null })
  })

  it('keeps a manual selection pending until an exact request header consumes it', () => {
    const profileId = brandString<PromptProfileId>('custom-codex')
    const revision = brandString<PromptProfileRevision>('3')
    const selected = applyPromptProfileProjection(initial, event({
      type: 'prompt-profile/selection',
      data: { mode: 'manual', profileId, revision },
    }))
    expect(selected.pending).toEqual({ mode: 'manual', profileId, revision })

    const unrelated = applyPromptProfileProjection(selected, event({
      type: 'request/header',
      data: { header: { metadata: { promptProfile: {
        id: CODEX_PROMPT_PROFILE_ID,
        revision: brandString<PromptProfileRevision>('builtin-1'),
        source: 'auto',
      } } } },
    }))
    expect(unrelated.pending).toEqual({ mode: 'manual', profileId, revision })

    const consumed = applyPromptProfileProjection(unrelated, event({
      type: 'request/header',
      data: { header: { metadata: { promptProfile: { id: profileId, revision, source: 'manual' } } } },
    }))
    expect(consumed).toEqual({
      lastUsed: { id: profileId, revision, source: 'manual' },
      pending: null,
    })
  })

  it('keeps the latest changed selection and ignores the same selection', () => {
    const auto = event({ type: 'prompt-profile/selection', data: { mode: 'auto' } })
    expect(applyPromptProfileProjection(initial, auto)).toBe(initial)
    const manual = event({
      type: 'prompt-profile/selection',
      data: {
        mode: 'manual',
        profileId: HARNESS_PROMPT_PROFILE_ID,
        revision: brandString<PromptProfileRevision>('builtin-1'),
      },
    })
    const selected = applyPromptProfileProjection(initial, manual)
    expect(applyPromptProfileProjection(selected, manual)).toBe(selected)
  })
})
