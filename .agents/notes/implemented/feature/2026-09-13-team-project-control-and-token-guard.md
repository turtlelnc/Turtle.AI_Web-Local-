# Agent Note: Team project control and token guard

Status: implemented

English | [中文](2026-09-13-team-project-control-and-token-guard.zh.md)

## Problem

An Agent Team can coordinate tasks without a shared statement of the work mode, which makes product discovery, maintenance, and incident repair drift into the same generic behavior. Users also need a visible way to stop a long-running team before it consumes more of their permitted model usage, but providers do not expose one portable or reliable account-balance interface.

## Decision

The Team Lead stores a named project and one revisioned built-in preset in its durable Team log. The preset selects new-product discovery, improvement of an existing product, focused problem repair, or freeform work. The tool adapter reads that logged selection into every Team member's policy while preserving the existing Team tools, authority rules, sessions, and shared task board.

The project may include a Team-wide local token limit and a remaining-token warning threshold. `TeamProjectControl` sums the existing token-meter projections, persists each member's latest cumulative provider-reported usage, pauses the project at the limit, cancels live Team turns with inbox preservation, and rejects later requests until the Lead changes the configuration. It also pauses a configured project for HTTP 402 or a recognized explicit provider exhaustion code; HTTP 429 remains ordinary rate limiting.

The Web Team panel is the user control point. It displays the selected preset and a calm status, labels measurements as provider-reported usage or a provider-limit signal, and does not describe either as an account balance. The `agentTeams/configureProject` Remote method keeps project changes explicit and durable without adding a second agent loop or a new provider path.

The Team policy requires a fixed handoff order: outcome, evidence, changed files or artifacts, verification, risks or unresolved questions, and recommended next action. Each section is present even when empty, facts remain separate from inference, and a receiver acknowledges unresolved risk before relying on the handoff.

## Alternatives considered

**Query a universal provider balance before every request.** Rejected because ChatGPT/Codex and compatible providers do not provide one reliable cross-provider balance or reset interface, and reporting a guessed balance would be misleading.

**Stop on every provider error or HTTP 429.** Rejected because transient rate limiting, timeouts, and transport failures are not evidence of exhausted allowance. Only the local guard and explicit exhaustion signals pause the Team.

**Create a separate project-management runtime.** Rejected because Team sessions, task ownership, cancellation, and browser state already have durable owners. Project control extends the Team log and adapter instead of duplicating them.

**Allow arbitrary full replacement of the Team policy.** Rejected because the handoff, authority, safety, and tool contracts would become unauditable. The built-in presets vary work mode while the existing safety rules stay intact.

## Consequences

The project and usage log grows with configuration changes and usage updates, favoring recovery and auditability over an implicit in-memory meter. A limit measures reported tokens across Team members rather than currency, hidden quota, or a guaranteed future reset; users can still choose a conservative local ceiling.

Selected presets make project intent visible to all Team members and the panel, while the fixed handoff makes delegation results easier to review. The feature remains experimental with Agent Teams and does not enable autonomous Team creation or impose a provider/model selection policy.
