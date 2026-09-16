---
description: "Provider-independent, versioned Agent behavior profiles and per-session Auto/manual selection."
kind: "package-reference"
---

# @deepseek-ai/dsh-prompt-profiles

English | [中文](README.zh.md)

## Summary

This package keeps Agent behavior independent from model transport. It ships `codex`, `deepseek-harness`, and manually selected `flash-first` profiles, resolves Auto mode from the atomically captured provider, versions constrained custom profiles, and records the exact effective profile in every request header. It reuses the Harness agent loop, tools, permissions, project instructions, Skills, environment, and history; only the persona/working-style system-prompt section changes.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount the service after session projections, settings, system-prompt assembly, and the default-model service. Auto maps ChatGPT/Codex and official OpenAI routes to Codex behavior; DeepSeek, compatible, and unknown routes map to Harness behavior. A manual selection stays fixed when the model changes.

Custom profiles inherit one built-in base and may add instructions or choose progress/detail style. Edits append an immutable revision. Existing sessions continue naming their selected revision until explicitly changed.

The current `codex` and `flash-first` revisions share an observable work policy: inspect before asking, use the repository's compatible runtime, preserve unrelated changes, distinguish baseline failures from regressions, recover through evidence-based attempts, and require verification proportionate to risk. They distinguish verified facts, user-stated constraints, inferences, assumptions, and unknowns, and prohibit invented balance, usage, cost, timing, and test claims. Historical built-in revisions remain resolvable for sessions that selected them; a new custom revision captures the current built-in base revision.

`flash-first` keeps routine work on the parent model and reserves model-selectable `subagent` calls for high-impact decisions, difficult root causes, milestone reviews, and release audits. For unfamiliar product work it researches only while a decision-relevant uncertainty is being reduced, inspects existing evidence before asking, studies the problem behind a competitor pattern instead of copying it, and proceeds with a small reversible milestone once major risks have a verification plan. An interactive milestone can then receive a fresh-context first-time-user evaluation that gets no project intent or preferred verdict. Its research and specialist handoffs separate verified facts, user-stated constraints, inferences, assumptions, unknowns, attempts, scope, and expected output. The profile does not choose or authorize providers: deployments keep DeepSeek-V4-Flash as the base default, while the Subagent settings allowlist controls which stronger routes the model may request.

<a id="model-experience"></a>
## Model Experience

### Active Prompt Profile

#### What the model sees

The resolved profile replaces the `persona-prefix` working-style section; a mid-session change also contributes one short user-role continuity notice before the next request.

#### Token effect

Every request carries one built-in base plus any selected `additionalInstructions` and explicit progress/detail behavior; tool, permission, project, Skills, environment, and history tokens are unchanged.

#### KV Cache effect

An effective profile change starts a new request series because it changes the system-prompt prefix. Re-selecting the same profile is a no-op and preserves the established series.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Custom profiles cannot replace tool schemas, safety policy, permissions, environment, or session protocol.
- Removing a custom profile hides it from catalogs but preserves revisions referenced by session history.
- `prompt-profile/selection` is an ordinary ignorable v2 event. Old v2 logs already mean Auto, while `request/header.metadata.promptProfile` records the exact effective revision.

The [fusion architecture Agent Note](../../../.agents/notes/implemented/architecture/2026-09-08-deepseek-harness-codex-fusion.md) records the boundary decision.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Revision ownership</summary>

The service owns immutable profile revisions and request-time resolution; providers supply transport facts but never choose a profile.

</details>

**Runtime invariant:** No companion is published because profile resolution, revision immutability, and request-header recording are owned by the session and system-prompt pipeline; this package exposes no same-process mutable relation for a Cordis listener to compare.
