# Agent Note: Product discovery and clean-room user testing

Status: implemented

English | [中文](2026-09-11-product-discovery-and-clean-room-user-testing.zh.md)

## Problem

An implementation-first coding agent can efficiently build the requested feature without establishing whether a real user problem exists, which alternatives already satisfy it, or which small experiment would disprove the product idea. A teammate that inherits the product discussion has the opposite evaluation problem: it knows the intended workflow and tends to explain or defend it instead of discovering what a first-time user sees.

## Decision

The `flash-first` Prompt Profile and experimental Agent Teams policy treat product discovery as a time-boxed first phase for real product creation unless the user requests direct execution. The Lead identifies the user problem, target users, alternatives, evidence, assumptions, differentiators, feasibility risks, smallest useful release, and measurable success criteria before substantial implementation.

The experimental Team tool set exposes `spawn_user_tester`. The Lead supplies a unique tester name and an ordinary-user application entry. The tool always uses the configured fresh provider, fixes the teammate description, and constructs a neutral evaluation task that forbids source, repository, roadmap, developer-discussion, and prior-agent access. The evaluator freely explores the application and reports its inferred purpose, useful qualities, friction, trust concerns, continued-use intent, replacement risk, and three prioritized improvements. Its report separates observation, reaction, and proposed changes. Its task permits at most twelve tool calls; an inaccessible entry gets one simple retry, then a limitation report, with credential hunting and authentication bypass explicitly prohibited.

The Web Team panel leads with a calm summary of overall state, the current ready or active task, completed task count, active member count, and whether the user needs to review a problem. Roster and task detail remain available below the summary.

Fresh conversation history provides information isolation, not technical confinement. The teammate still shares the deployment and working directory. A deployment that requires enforcement uses a sandboxed UI-only provider; the policy tells an evaluator without application access to report that limitation rather than inspect implementation files.

## Alternatives considered

**Give the ordinary `spawn_teammate` tool a recommended prompt.** This leaves the Lead free to add product intent, prescribed workflows, and preferred conclusions, so different calls do not preserve the clean-room condition.

**Fork the parent conversation for convenience.** A fork carries precisely the product rationale and prior findings that bias a first-time-user evaluation, so the dedicated tool always selects the fresh provider.

**Treat the evaluator as a security sandbox.** Prompt restrictions cannot confine filesystem or process tools. The feature states its informational guarantee and leaves technical confinement to the provider that owns tools and execution.

**Show every diagnostic and Agent transition as the panel summary.** Raw activity makes normal investigation look like product failure. The summary presents actionable project state first and retains detailed roster, diagnostics, and tasks for inspection.

## Consequences

The Lead can challenge product value before committing implementation cost and can commission a repeatable first-time-user evaluation without transmitting project history. The dedicated schema adds prompt and tool-token cost to every Team member request, and the richer Flash-first instructions add prompt cost whenever that profile is selected. The fixed action ceiling prevents an access failure from expanding into credential or endpoint exploration. A single synthetic user remains weak evidence: costly decisions require repeated independent observations or real-user evidence. Focused tool tests pin fresh routing and prompt contents; Client tests pin the calm summary, while the assembled Web snapshot covers the complete panel.
