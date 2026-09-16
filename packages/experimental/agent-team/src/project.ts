/** Durable project preset selection and provider-reported usage guard. */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-token-meter'
import type { TeamJournal } from './journal.ts'
import type { TeamMembership, TeamRoster } from './roster.ts'
import { TeamError } from './error.ts'
import { TeamId } from './types.ts'
import type {
  ConfigureTeamProjectRequest,
  TeamProjectPresetId,
  TeamProjectSnapshot,
  TeamProjectView,
} from './types.ts'
import { requiredText } from './validation.ts'

const PRESET_INSTRUCTIONS: Readonly<Record<TeamProjectPresetId, string>> = {
  'new-product': 'Start with bounded product discovery. Establish the user problem, target users, alternatives, evidence, feasibility, smallest useful release, and success criteria before substantial implementation. Include an independent first-time-user evaluation after an interactive milestone exists.',
  'improve-existing': 'Run and understand the existing product before changing it. Identify user friction, compatibility constraints, and the smallest high-value improvements. Preserve working infrastructure, validate regressions, and use an independent first-time-user evaluation when it can change priorities.',
  'fix-problem': 'Reproduce the problem, collect evidence, identify the root cause, make the smallest complete fix, add regression coverage, and verify the real user path. Skip unrelated product discovery and refactoring.',
  'freeform': 'Follow the user request directly. Scale planning and delegation to the actual task, and do not create process work that cannot change the result.',
}

const PROVIDER_LIMIT_CODES = new Set([
  'CREDIT_BALANCE_EXHAUSTED',
  'INSUFFICIENT_CREDITS',
  'INSUFFICIENT_QUOTA',
  'USAGE_LIMIT_REACHED',
])

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TeamError(`${name} must be a positive safe integer`, 'TEAM_INVALID_ARGUMENT')
  }
  return value
}

function nonNegativeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TeamError(`${name} must be a non-negative safe integer`, 'TEAM_INVALID_ARGUMENT')
  }
  return value
}

function totalUsage(ctx: Context, membership: TeamMembership): number {
  const state = ctx.sessionProjections.stateOf(membership.root.session, 'agentTeam')
  if (state === undefined || state.failure !== undefined) return 0
  const totals = new Map(state.memberUsage.map(item => [item.memberId, item.totalTokens]))
  for (const id of [membership.root.id, ...state.members.map(member => member.id)]) {
    const live = ctx.agents.get(id)
    if (live === undefined) continue
    const usage = ctx.sessionProjections.stateOf(live.session, 'tokenUsage')?.totals
    if (usage === undefined) continue
    const value = usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
    totals.set(id, Math.max(totals.get(id) ?? 0, value))
  }
  return [...totals.values()].reduce((sum, value) => sum + value, 0)
}

/** Owns project configuration, honest budget status, and request admission. */
export class TeamProjectControl {
  constructor(
    private readonly ctx: Context,
    private readonly journal: TeamJournal,
    private readonly roster: TeamRoster,
  ) {}

  /** Return the model-facing working agreement for the selected preset. */
  instruction(agent: Agent): string | undefined {
    const membership = this.roster.tryMembership(agent)
    if (membership === undefined) return undefined
    const project = this.journal.state(membership.root).project
    if (project === undefined) return undefined
    return `Project "${project.name}" uses the ${project.presetId} preset (${project.presetRevision}). ${PRESET_INSTRUCTIONS[project.presetId]}`
  }

  /** Configure or resume one Team project. */
  async configure(caller: Agent, request: ConfigureTeamProjectRequest): Promise<TeamProjectView> {
    const membership = this.roster.membership(caller)
    if (membership.role !== 'lead') throw new TeamError('only the Team Lead can configure the project', 'TEAM_LEAD_REQUIRED')
    const name = requiredText(request.name, 'project name', 200)
    const tokenBudget = request.limitTokens === undefined
      ? undefined
      : {
        limitTokens: positiveInteger(request.limitTokens, 'limitTokens'),
        warnAtRemainingTokens: request.warnAtRemainingTokens === undefined
          ? 0
          : nonNegativeInteger(request.warnAtRemainingTokens, 'warnAtRemainingTokens'),
      }
    if (tokenBudget !== undefined && tokenBudget.warnAtRemainingTokens >= tokenBudget.limitTokens) {
      throw new TeamError('warnAtRemainingTokens must be lower than limitTokens', 'TEAM_INVALID_ARGUMENT')
    }
    return await this.journal.transact(membership.root.id, async () => {
      const prior = this.journal.state(membership.root).project
      const project: TeamProjectSnapshot = {
        revision: (prior?.revision ?? 0) + 1,
        name,
        presetId: request.presetId,
        presetRevision: 'builtin-1',
        ...tokenBudget === undefined ? {} : { tokenBudget },
        phase: 'active',
      }
      await this.journal.appendAndFlush(membership.root, 'team/project', {
        version: 2,
        teamId: TeamId(membership.root.id),
        project,
      })
      await this.pauseIfExceeded(membership)
      const view = this.view(membership)
      /* v8 ignore next -- the project event above makes the view present synchronously. */
      if (view === undefined) throw new Error('configured project is missing from its projection')
      return view
    })
  }

  /** Build one project view without presenting usage as an account balance. */
  view(membership: TeamMembership): TeamProjectView | undefined {
    const project = this.journal.state(membership.root).project
    if (project === undefined) return undefined
    const usedTokens = totalUsage(this.ctx, membership)
    const limit = project.tokenBudget
    const remainingTokens = limit === undefined ? undefined : Math.max(0, limit.limitTokens - usedTokens)
    const status = project.phase === 'paused'
      ? 'paused'
      : limit === undefined
        ? 'unconfigured'
        : remainingTokens !== undefined && remainingTokens <= limit.warnAtRemainingTokens
          ? 'warning'
          : 'healthy'
    return {
      revision: project.revision,
      name: project.name,
      presetId: project.presetId,
      presetRevision: project.presetRevision,
      phase: project.phase,
      budget: {
        status,
        accuracy: project.pauseReason === 'provider-limit'
          ? 'provider-limit-signal'
          : 'provider-reported-usage',
        usedTokens,
        ...limit === undefined ? {} : {
          limitTokens: limit.limitTokens,
          remainingTokens: Math.max(0, limit.limitTokens - usedTokens),
          warnAtRemainingTokens: limit.warnAtRemainingTokens,
        },
        ...project.pauseReason === undefined ? {} : { pauseReason: project.pauseReason },
        ...project.provider === undefined ? {} : { provider: project.provider },
      },
    }
  }

  /** Persist the latest cumulative usage after one provider settlement. */
  async recordUsage(agent: Agent): Promise<void> {
    const membership = this.roster.tryMembership(agent)
    if (membership === undefined) return
    const usage = this.ctx.sessionProjections.stateOf(agent.session, 'tokenUsage')?.totals
    if (usage === undefined) return
    const totalTokens = usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
    await this.journal.transact(membership.root.id, async () => {
      const state = this.journal.state(membership.root)
      if (state.memberUsage.find(item => item.memberId === agent.id)?.totalTokens === totalTokens) return
      await this.journal.appendAndFlush(membership.root, 'team/member-usage', {
        version: 2,
        teamId: TeamId(membership.root.id),
        usage: { memberId: agent.id, totalTokens },
      })
      await this.pauseIfExceeded(membership)
    })
  }

  /** Reject a model request while a project budget is paused or already exhausted. */
  async assertRequestAllowed(agent: Agent): Promise<void> {
    const membership = this.roster.tryMembership(agent)
    if (membership === undefined) return
    await this.journal.transact(membership.root.id, async () => {
      await this.pauseIfExceeded(membership)
      if (this.journal.state(membership.root).project?.phase === 'paused') {
        throw new TeamError('project budget is paused; update the budget before continuing', 'TEAM_BUDGET_PAUSED')
      }
    })
  }

  /** Recognize explicit provider exhaustion without treating ordinary rate limits as depleted balance. */
  isProviderLimit(code: string, status?: number): boolean {
    return status === 402 || PROVIDER_LIMIT_CODES.has(code.toUpperCase())
  }

  /** Pause one Team after an explicit provider limit response. */
  async pauseForProviderLimit(agent: Agent, provider: string): Promise<boolean> {
    const membership = this.roster.tryMembership(agent)
    if (membership === undefined) return false
    return await this.journal.transact(membership.root.id, async () => {
      if (this.journal.state(membership.root).project === undefined) return false
      await this.pause(membership, 'provider-limit', provider)
      return true
    })
  }

  private async pauseIfExceeded(membership: TeamMembership): Promise<void> {
    const project = this.journal.state(membership.root).project
    if (project?.phase !== 'active' || project.tokenBudget === undefined) return
    if (totalUsage(this.ctx, membership) < project.tokenBudget.limitTokens) return
    await this.pause(membership, 'token-budget')
  }

  private async pause(
    membership: TeamMembership,
    reason: 'token-budget' | 'provider-limit',
    provider?: string,
  ): Promise<void> {
    const current = this.journal.state(membership.root).project
    if (current === undefined || current.phase === 'paused') return
    const project: TeamProjectSnapshot = {
      ...current,
      revision: current.revision + 1,
      phase: 'paused',
      pauseReason: reason,
      ...provider === undefined ? {} : { provider },
    }
    await this.journal.appendAndFlush(membership.root, 'team/project', {
      version: 2,
      teamId: TeamId(membership.root.id),
      project,
    })
    const state = this.journal.state(membership.root)
    for (const id of [membership.root.id, ...state.members.map(member => member.id)]) {
      this.ctx.agents.get(id)?.cancel({ kind: 'user' }, { keepInbox: true })
    }
  }
}
