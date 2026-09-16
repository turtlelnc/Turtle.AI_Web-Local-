# Agent Note: Evidence-based agent research and Team roles

Status: implemented

English | [中文](2026-09-16-evidence-based-agent-research-and-team-roles.zh.md)

## Problem

The existing Codex and Flash-first behavior encouraged autonomy, product discovery, and selective premium-model escalation, but did not define a complete observable recovery policy. It could still ask before inspecting, treat any pre-existing failure as an excuse, assume a package manager or runtime, or report completion without evidence proportionate to risk. Product research also lacked explicit evidence classes and proceed, narrow, redirect, or stop criteria. Generic durable teammates required the Lead to rewrite Explorer, Builder, and Reviewer responsibilities on every delegation.

## Decision

Built-in Prompt Profile revision `builtin-2` adds a shared observable work policy to `codex` and `flash-first`. The policy requires inspection before questions, autonomous reversible in-scope work, repository-compatible command selection, preservation of unrelated changes, classification of baseline failures, a bounded error-recovery ladder, regression repair, evidence-proportionate verification, and concise delivery. It distinguishes verified facts, user-stated constraints, inferences, assumptions, and unknowns, and prohibits invented usage, cost, timing, compatibility, and test claims.

Flash-first additionally researches unfamiliar product work only while research reduces a decision-relevant uncertainty. It inspects the request, repository, existing behavior, workflow, alternatives, and constraints; studies the problem and tradeoff behind competitor patterns instead of copying them; and proceeds with a small reversible milestone once major risks have a verification plan. It narrows, redirects, or stops for demonstrated impossibility, conflicting requirements, unavailable critical dependencies, disproved value, or exhausted authority or budget. It does not require redundant approval after the user has already authorized safe implementation.

The Prompt Profile registry retains `builtin-1` definitions for exact manual session resolution while catalogs and Auto mode expose `builtin-2`. A profile definition may record `baseRevision`; old persisted custom profiles without the field resolve against `builtin-1`, while newly created revisions capture `builtin-2`. This prevents a recorded profile revision from silently acquiring a different base prompt.

The experimental `spawn_teammate` tool accepts an optional `explorer`, `builder`, or `reviewer` role. The adapter prefixes the delegated task with a stable role contract. Explorer gathers sourced evidence without editing, Builder owns one implementation scope and focused verification, and Reviewer independently reports prioritized findings without editing. These are prompt-level roles, not a filesystem or process security boundary. The dedicated `spawn_user_tester` remains the neutral first-time-user path, and one-shot model-selectable subagents remain the premium-specialist path.

## Alternatives considered

**Copy the external research answer verbatim.** Its Windows 7, Python, UI framework, market, and architecture examples were unverified and did not describe this repository. Fixed research percentages, arbitrary unanswered-question thresholds, and mandatory approval would also cause unnecessary stops. Only the observable evidence and decision framework was retained.

**Change the existing built-in prompt under `builtin-1`.** Request headers and manual selections would then claim the same immutable revision while producing different behavior. Historical built-ins and captured base revisions preserve the meaning of recorded selections.

**Enforce Team roles in the Team domain.** Explorer and Reviewer read-only behavior cannot be guaranteed by a text role while teammates share one workspace and tool surface. The tool and documentation state the limit and leave technical confinement to a sandboxed provider.

**Build automatic retry and model routing into the Agent Loop.** The fusion architecture retains the Harness loop. This change defines observable policy and reuses the existing model-selectable subagent allowlist; deterministic transport retry remains owned by provider and runtime seams.

## Consequences

The default Codex experience and optional Flash-first coordinator now share clearer autonomy, recovery, evidence, and completion behavior without changing providers, tools, permissions, sessions, or the Agent Loop. Product research can stop when it no longer changes a decision instead of consuming a fixed percentage of budget. Team Leads can create repeatable functional roles with less prompt duplication, while users are not misled into treating those roles as sandboxes. The richer prompts add stable prefix tokens, and `builtin-2` intentionally starts a new request series when selected. Focused tests cover unchanged generic delegation and role-prefixed delegation; generated catalogs expose the new optional field.
