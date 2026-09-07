/** Provider-independent Prompt Profile registry, resolution, and request assembly. */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { boundContextSummary, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Session } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import { PERSONA_PREFIX_SECTION } from '@deepseek-ai/dsh-system-prompt'
import { installPromptProfileProjection, samePromptProfileSelection, selectionFromEffective } from './projection.ts'
import type {
  EffectivePromptProfile,
  PromptProfileDefinition,
  PromptProfileDraft,
  PromptProfileDefaultRule,
  PromptProfileId,
  PromptProfileRevision,
  PromptProfileSelection,
} from './types.ts'

export type * from './types.ts'
export { applyPromptProfileProjection, samePromptProfileSelection, selectionFromEffective } from './projection.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Provider-independent Prompt Profile registry and resolver. */
    promptProfiles: PromptProfileRegistry
  }
}

/** User-settings namespace that stores immutable custom profile revisions. */
export const PROMPT_PROFILE_SETTINGS_NAMESPACE = 'prompt-profiles'

/** Built-in Codex Prompt Profile identity. */
export const CODEX_PROMPT_PROFILE_ID = brandString<PromptProfileId>('codex')

/** Built-in DeepSeek Harness Prompt Profile identity. */
export const HARNESS_PROMPT_PROFILE_ID = brandString<PromptProfileId>('deepseek-harness')

const DEFAULT_RULES: readonly PromptProfileDefaultRule[] = [
  { providers: ['chatgpt-codex', 'openai', 'openai-codex'], profileId: CODEX_PROMPT_PROFILE_ID },
  { providers: '*', profileId: HARNESS_PROMPT_PROFILE_ID },
]

const BUILTIN_REVISION = brandString<PromptProfileRevision>('builtin-1')

const DEFAULT_BEHAVIOR = {
  progressUpdates: 'inherit',
  responseDetail: 'inherit',
} as const

const HARNESS_PROMPT = 'You are a coding agent powered by the {{model}} model.'

const CODEX_PROMPT = `You are a coding agent powered by the {{model}} model, running inside DeepSeek Harness.

Work as an autonomous, careful collaborator. Inspect relevant files and configuration before changing code. Reuse the existing architecture and extension points. Keep the user informed with concise progress updates during longer work, continue until the requested outcome is genuinely handled, and verify changes with focused tests. Preserve unrelated work, treat destructive actions cautiously, and make failures explicit. In the final response, lead with the outcome and mention only the most useful implementation and verification details.`

const BUILT_INS: readonly PromptProfileDefinition[] = [
  {
    id: CODEX_PROMPT_PROFILE_ID,
    name: 'Codex',
    base: 'codex',
    additionalInstructions: '',
    behavior: DEFAULT_BEHAVIOR,
    revision: BUILTIN_REVISION,
    builtIn: true,
  },
  {
    id: HARNESS_PROMPT_PROFILE_ID,
    name: 'DeepSeek Harness',
    base: 'deepseek-harness',
    additionalInstructions: '',
    behavior: DEFAULT_BEHAVIOR,
    revision: BUILTIN_REVISION,
    builtIn: true,
  },
]

/** Resolve Auto mode without coupling the result to a provider adapter. */
export function defaultPromptProfileId(provider: string): PromptProfileId {
  return DEFAULT_RULES.find(rule => rule.providers === '*'
    || rule.providers.includes(provider))?.profileId ?? HARNESS_PROMPT_PROFILE_ID
}

interface PromptProfileSettings {
  readonly customProfiles: PromptProfileDefinition[]
  readonly hiddenProfileIds: string[]
}

const behaviorSchema = z.object({
  progressUpdates: z.union(['inherit', 'concise', 'off'] as const).default('inherit'),
  responseDetail: z.union(['inherit', 'concise', 'balanced', 'detailed'] as const).default('inherit'),
})

const definitionSchema = z.object({
  id: z.string().required(),
  name: z.string().required(),
  base: z.union(['codex', 'deepseek-harness'] as const).required(),
  additionalInstructions: z.string().default(''),
  behavior: behaviorSchema.required(),
  revision: z.string().required(),
  builtIn: z.boolean().default(false),
}) as z<PromptProfileDefinition>

const settingsSchema = z.object({
  customProfiles: z.array(definitionSchema).default([]),
  hiddenProfileIds: z.array(z.string()).default([]),
}) as z<PromptProfileSettings>

const EMPTY_SETTINGS: PromptProfileSettings = { customProfiles: [], hiddenProfileIds: [] }
const ID_PATTERN = /^[a-z][a-z0-9-]*$/

function profileText(profile: PromptProfileDefinition): string {
  const sections = [profile.base === 'codex' ? CODEX_PROMPT : HARNESS_PROMPT]
  if (profile.additionalInstructions.trim() !== '') sections.push(profile.additionalInstructions.trim())
  if (profile.behavior.progressUpdates === 'concise') {
    sections.push('Give brief progress updates while work is in progress.')
  } else if (profile.behavior.progressUpdates === 'off') {
    sections.push('Do not provide progress updates unless the user asks for them.')
  }
  const detail = profile.behavior.responseDetail
  if (detail !== 'inherit') sections.push(`Use a ${detail} level of detail in the final response.`)
  return sections.join('\n\n')
}

function effective(profile: PromptProfileDefinition, source: 'auto' | 'manual'): EffectivePromptProfile {
  return { id: profile.id, revision: profile.revision, source }
}

function sameEffective(left: EffectivePromptProfile | undefined, right: EffectivePromptProfile): boolean {
  return left?.id === right.id && left.revision === right.revision && left.source === right.source
}

function switchNotice(previous: EffectivePromptProfile, selected: EffectivePromptProfile) {
  const from = previous.id
  const to = selected.id
  return createUserMessage({
    content: [{
      type: 'text' as const,
      text: `[prompt profile changed: instructions above used ${from}; the session continues with ${to}]`,
    }],
    source: {
      kind: 'plugin' as const,
      plugin: 'prompt-profiles',
      form: 'notice' as const,
      summary: boundContextSummary(`${from} → ${to}`),
    },
  })
}

/** Registry and resolver for built-in and immutable custom Prompt Profiles. */
export class PromptProfileRegistry extends Service {
  static inject = ['agentDefaultModel', 'agents', 'sessionProjections', 'systemPrompt']

  private source: () => PromptProfileSettings = () => EMPTY_SETTINGS
  private readonly assembled = new WeakMap<Agent, EffectivePromptProfile>()

  /** Install projection, settings, and request-assembly behavior. */
  constructor(ctx: Context) {
    super(ctx, 'promptProfiles')
    installPromptProfileProjection(ctx)
    ctx.inject(['settings'], (settingsCtx) => {
      settingsCtx.settings.installSection(
        ctx,
        PROMPT_PROFILE_SETTINGS_NAMESPACE,
        settingsSchema,
        EMPTY_SETTINGS,
        { setSource: (current) => { this.source = current }, onChange: () => {} },
      )
    })
    ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
      const assembled = await next()
      const agent = context.agent
      if (agent === undefined) return assembled
      const selection = this.selectionFor(agent.session)
      const provider = context.modelSelection?.provider
        ?? agent.session.requestHeader()?.config.provider
        ?? ctx.agentDefaultModel.currentSelection().provider
      const resolved = this.resolve(selection, provider)
      const applied = effective(resolved, selection.mode === 'auto' ? 'auto' : 'manual')
      this.assembled.set(agent, applied)
      return {
        ...assembled,
        sections: assembled.sections.map(section => section.name === PERSONA_PREFIX_SECTION
          ? { ...section, text: profileText(resolved) }
          : section),
        metadata: { ...assembled.metadata, promptProfile: applied },
      }
    })
    ctx.on('agent/pre-step', async ({ agent, signal }, next) => {
      const decision = await next()
      if (decision.kind === 'reject' || signal.aborted) return decision
      const selected = this.assembled.get(agent)
      const previous = agent.session.requestHeader()?.metadata?.promptProfile
      if (selected === undefined || previous === undefined || sameEffective(previous, selected)) return decision
      return {
        ...decision,
        messages: [...decision.messages, switchNotice(previous, selected)],
        startsRequestSeries: true,
      }
    }, { prepend: true })
  }

  /** List built-ins and current visible custom revisions. */
  list(): PromptProfileDefinition[] {
    const settings = this.source()
    const hidden = new Set(settings.hiddenProfileIds)
    const latest = new Map<string, PromptProfileDefinition>()
    for (const profile of settings.customProfiles) latest.set(profile.id, profile)
    return [...BUILT_INS, ...[...latest.values()].filter(profile => !hidden.has(profile.id))]
      .map(profile => structuredClone(profile))
  }

  /** Return the ordered provider-to-profile rules used by Auto mode. */
  defaultRules(): PromptProfileDefaultRule[] {
    return structuredClone([...DEFAULT_RULES])
  }

  /** Resolve one selection against its exact revision or provider default. */
  resolve(selection: PromptProfileSelection, provider: string): PromptProfileDefinition {
    if (selection.mode === 'auto') {
      const id = defaultPromptProfileId(provider)
      return structuredClone(BUILT_INS.find(profile => profile.id === id) as PromptProfileDefinition)
    }
    const profile = [...BUILT_INS, ...this.source().customProfiles].find(candidate =>
      candidate.id === selection.profileId && candidate.revision === selection.revision)
    if (profile === undefined) {
      throw new Error(`prompt profile "${selection.profileId}" revision "${selection.revision}" is unavailable`)
    }
    return structuredClone(profile)
  }

  /** Read the pending or last-used selection for one Session; old logs default to Auto. */
  selectionFor(session: Session): PromptProfileSelection {
    const state = this.ctx.sessionProjections.stateOf(session, 'promptProfileSelection')
    if (state === undefined) throw new Error('prompt-profiles: required promptProfileSelection projection is unavailable')
    return state.pending ?? (state.lastUsed === null ? { mode: 'auto' } : selectionFromEffective(state.lastUsed))
  }

  /** Validate and append a changed selection for the next request. */
  select(session: Session, selection: PromptProfileSelection): boolean {
    if (selection.mode === 'manual') this.resolve(selection, '')
    const current = this.selectionFor(session)
    if (samePromptProfileSelection(current, selection)) return false
    session.append('prompt-profile/selection', selection)
    return true
  }

  /** Create a custom profile at revision 1 and persist it. */
  async create(draft: PromptProfileDraft): Promise<PromptProfileDefinition> {
    const id = brandString<PromptProfileId>(draft.id ?? this.slug(draft.name))
    this.validateDraft(id, draft)
    if ([...BUILT_INS, ...this.source().customProfiles].some(profile => profile.id === id)) {
      throw new Error(`prompt profile "${id}" already exists`)
    }
    return this.persistRevision(id, brandString<PromptProfileRevision>('1'), draft)
  }

  /** Append and persist the next immutable revision of one custom profile. */
  async update(id: PromptProfileId, draft: PromptProfileDraft): Promise<PromptProfileDefinition> {
    this.validateDraft(id, draft)
    if (BUILT_INS.some(profile => profile.id === id)) throw new Error(`built-in prompt profile "${id}" cannot be edited`)
    const revisions = this.source().customProfiles.filter(profile => profile.id === id)
    if (revisions.length === 0) throw new Error(`prompt profile "${id}" does not exist`)
    const next = Math.max(...revisions.map(profile => Number(profile.revision))) + 1
    return this.persistRevision(id, brandString<PromptProfileRevision>(String(next)), draft)
  }

  /** Hide one custom profile from catalogs while retaining immutable revisions for sessions. */
  async remove(id: PromptProfileId): Promise<void> {
    if (BUILT_INS.some(profile => profile.id === id)) throw new Error(`built-in prompt profile "${id}" cannot be removed`)
    const settings = this.source()
    if (!settings.customProfiles.some(profile => profile.id === id)) {
      throw new Error(`prompt profile "${id}" does not exist`)
    }
    if (settings.hiddenProfileIds.includes(id)) return
    await this.replace({ ...settings, hiddenProfileIds: [...settings.hiddenProfileIds, id] })
  }

  private async persistRevision(
    id: PromptProfileId,
    revision: PromptProfileRevision,
    draft: PromptProfileDraft,
  ): Promise<PromptProfileDefinition> {
    const profile: PromptProfileDefinition = {
      id,
      name: draft.name.trim(),
      base: draft.base,
      additionalInstructions: draft.additionalInstructions,
      behavior: { ...draft.behavior },
      revision,
      builtIn: false,
    }
    const settings = this.source()
    await this.replace({
      customProfiles: [...settings.customProfiles, profile],
      hiddenProfileIds: settings.hiddenProfileIds.filter(hidden => hidden !== id),
    })
    return structuredClone(profile)
  }

  private replace(settings: PromptProfileSettings): Promise<void> {
    const provider = this.ctx.get('settings')
    if (provider === undefined) throw new Error('prompt profile authoring requires a settings provider')
    return provider.replace(PROMPT_PROFILE_SETTINGS_NAMESPACE, settings)
  }

  private validateDraft(id: string, draft: PromptProfileDraft): void {
    if (!ID_PATTERN.test(id)) throw new Error(`prompt profile id "${id}" must match ${String(ID_PATTERN)}`)
    if (draft.name.trim() === '') throw new Error('prompt profile name must not be empty')
  }

  private slug(name: string): string {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    return ID_PATTERN.test(slug) ? slug : 'custom-profile'
  }
}

export default PromptProfileRegistry
