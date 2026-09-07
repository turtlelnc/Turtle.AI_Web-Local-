# Agent Note: DeepSeek Harness and Codex fusion boundary

Status: implemented

English | [中文](2026-09-08-deepseek-harness-codex-fusion.zh.md)

## Problem

ChatGPT authentication and Codex-style Agent behavior are valuable, but adopting the complete Codex CLI or app-server would introduce a second Agent loop, tool protocol, approval system, and session owner. It would also make Codex's native-platform support a prerequisite for a product whose compatibility baseline is Windows 10 1709.

## Decision

DeepSeek Harness remains the sole product runtime. Its Agent loop, tools, shell, files, permissions, sessions, Remote API, React/Cordis frontend, Electron, Node, PowerShell, and packaging versions stay authoritative.

Provider transport and Prompt Profile are independent axes. `@deepseek-ai/dsh-prompt-profiles` resolves Auto outside providers and changes only the persona/working-style prompt section. Request assembly atomically captures model selection and records the effective profile in request metadata. ChatGPT/Codex and official OpenAI default to `codex`; third-party and unknown providers default to `deepseek-harness`; manual choices persist across model changes.

Interactive login uses the existing authorization seam plus the secret-free `@deepseek-ai/dsh-api-authorization-controller` Remote namespace. A narrow Rust sidecar under `native/codex-auth-sidecar` pins official `codex-login` source at revision `f326857cf405fb254cf6c8f38766daff074fca6e`, speaks JSON-RPC over stdio, and contains no Agent loop, tools, or session logic. The existing pi-ai OAuth implementation remains the compatibility fallback. Release configuration may select the official sidecar only after the Win10 1709 gate succeeds; backends do not share or migrate tokens.

Session format remains v2. The new selection event is an ordinary ignorable event and request metadata is extensible, so old logs already mean Auto and no rewriting migration is justified.

The frontend keeps its current slots and interaction topology while adopting warm neutral surfaces, restrained DeepSeek blue, lower chrome, a readable centered transcript, collapsed secondary detail, and separate Model Providers and Prompt Profiles settings. It does not copy Claude.ai assets, typefaces, icons, copy, or exact layout.

## Security and compatibility boundaries

The sidecar alone owns its authentication persistence. Access tokens may enter Host memory for provider requests but never Renderer state, Remote results, session JSONL, or diagnostics. Sidecar process launch has no listening socket. Windows release validation requires x64 build 16299, binary import inspection, startup/ping, real login and refresh, Codex and DeepSeek requests, PowerShell, files, and session recovery. A sidecar failure can select the fallback only before a login/request begins and requires a fresh login.

## Alternatives considered

**Embed Codex CLI or app-server.** Rejected because it duplicates the Harness runtime and makes its platform/tool/session assumptions part of the Windows compatibility surface.

**Merge provider and prompt selection.** Rejected because it prevents supported combinations such as DeepSeek API with Codex behavior and makes future profiles transport-specific.

**Copy sidecar tokens into Harness credential persistence.** Rejected because two stores would refresh and revoke the same grant independently, weakening ownership and logout guarantees.

**Bump session v2 to v3.** Rejected because the existing format explicitly permits ignorable event types and extensible request metadata; a format migration would add failure and audit risk without changing structural decoding.

**Rewrite the frontend.** Rejected because existing session, workspace, tool trace, settings, accessibility, and Windows-tested Electron foundations are assets rather than obstacles.

## Consequences

The product gains independent versioned behavior selection, deterministic per-request audit metadata, a browser-safe login surface, an official-auth sidecar boundary, and a quieter conversation-first UI without replacing the proven Harness runtime. The cost is an adapter boundary that must be maintained against a pinned Codex revision and a hard Windows VM gate before the official sidecar can become a release default. Until that gate passes, the shipped fallback remains visible rather than silently impersonating the official backend.
