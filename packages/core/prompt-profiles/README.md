---
description: "Provider-independent, versioned Agent behavior profiles and per-session Auto/manual selection."
kind: "package-reference"
---

# @deepseek-ai/dsh-prompt-profiles

English | [中文](README.zh.md)

## Summary

This package keeps Agent behavior independent from model transport. It ships `codex` and `deepseek-harness` profiles, resolves Auto mode from the atomically captured provider, versions constrained custom profiles, and records the exact effective profile in every request header. It reuses the Harness agent loop, tools, permissions, project instructions, Skills, environment, and history; only the persona/working-style system-prompt section changes.

## Use this package

Mount the service after session projections, settings, system-prompt assembly, and the default-model service. Auto maps ChatGPT/Codex and official OpenAI routes to Codex behavior; DeepSeek, compatible, and unknown routes map to Harness behavior. A manual selection stays fixed when the model changes.

Custom profiles inherit one built-in base and may add instructions or choose progress/detail style. Edits append an immutable revision. Existing sessions continue naming their selected revision until explicitly changed.

## Model Experience

### Active Prompt Profile

#### What the model sees

The resolved profile replaces the `persona-prefix` working-style section; a mid-session change also contributes one short user-role continuity notice before the next request.

#### Token effect

Every request carries one built-in base plus any selected `additionalInstructions` and explicit progress/detail behavior; tool, permission, project, Skills, environment, and history tokens are unchanged.

#### KV Cache effect

An effective profile change starts a new request series because it changes the system-prompt prefix. Re-selecting the same profile is a no-op and preserves the established series.

## Known Limitations and Deferred Work

- Custom profiles cannot replace tool schemas, safety policy, permissions, environment, or session protocol.
- Removing a custom profile hides it from catalogs but preserves revisions referenced by session history.
- `prompt-profile/selection` is an ordinary ignorable v2 event. Old v2 logs already mean Auto, while `request/header.metadata.promptProfile` records the exact effective revision.

The [fusion architecture Agent Note](../../../.agents/notes/implemented/architecture/2026-09-08-deepseek-harness-codex-fusion.md) records the boundary decision.
