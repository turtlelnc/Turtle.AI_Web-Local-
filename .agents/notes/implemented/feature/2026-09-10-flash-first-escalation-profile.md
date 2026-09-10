# Agent Note: Flash-first escalation profile

Status: implemented

English | [中文](2026-09-10-flash-first-escalation-profile.zh.md)

## Problem

Long project lifecycles waste premium-model tokens when every task, review, or repeated repository reading uses the strongest available route. Unstructured delegation also repeats context, omits evidence, and leaves the parent unable to distinguish a child's facts from its inferences.

## Decision

The Prompt Profile catalog includes the manually selected `flash-first` profile. It uses the DeepSeek Harness base behavior and treats the parent model as the default worker for routine research, proof-of-concept work, implementation, tests, documentation, packaging, and maintenance. The base composition keeps DeepSeek-V4-Flash as its transport-independent default model.

The profile escalates through the existing model-selectable `subagent` tool only for high-impact decisions, unresolved evidence-based debugging, contradictory evidence, complex state or concurrency, milestone batch review, release audit, or valuable independent specialist review. It tells the parent to query the authorized child-model catalog and choose the least expensive route that is clearly capable. Provider configuration and the Subagent model allowlist remain independent from the profile.

Every escalation carries a compact request with the task, decision or question, success criteria, constraints, verified facts, attempted work and results, authority, and expected return. Every child response separates its conclusion, evidence, risks and unknowns, recommended action, affected files or interfaces, and validation. The parent verifies and integrates the result and retains final responsibility.

Auto provider mapping remains unchanged: DeepSeek and compatible routes resolve to `deepseek-harness`, while official OpenAI and ChatGPT/Codex routes resolve to `codex`. Users select `flash-first` explicitly, so a provider change never silently installs cost-routing policy.

## Alternatives considered

**Make Flash-first the DeepSeek Auto profile.** Rejected because provider identity does not imply a user's budget policy, and it would weaken the existing Provider/Profile independence guarantee.

**Build a hidden automatic model router.** Rejected because the model catalog, credentials, prices, and user-authorized routes vary by deployment. The existing allowlist and explicit `provider` plus `model` tool parameters keep the choice visible and auditable.

**Send the entire conversation to each stronger model.** Rejected because it spends tokens repeatedly and obscures which evidence supports the delegated question. The fixed handoff headings require a bounded, reviewable context package.

**Run a premium review for every task.** Rejected because routine work has deterministic build, test, and log evidence. Milestone batch reviews preserve independent scrutiny at lower cost.

## Consequences

Users can combine a DeepSeek-V4-Flash parent with stronger authorized subagents without coupling prompts to transport. The fixed handoff protocol reduces repeated context and makes conclusions auditable. The policy remains guidance enforced by model-visible instructions rather than a cost meter, so users must configure the allowlist and select the profile for each intended session.
