---
description: "Secret-free Remote control surface for interactive Host-owned authorization attempts."
kind: "package-reference"
---

# @deepseek-ai/dsh-api-authorization-controller

English | [中文](README.zh.md)

## Table of Contents

- [Summary](#summary)
- [Behavior](#behavior)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="summary"></a>
## Summary

This Host service exposes `authorization.list/begin/respond/cancel/watch/logout` over the standard Remote protocol. Attempts, cancellation, prompts, and credentials remain Host-owned. Browser responses contain only flow metadata, safe notices, prompt descriptions, and terminal state; access and refresh tokens are never returned.

<a id="behavior"></a>
## Behavior

`begin` refuses an unknown method or a second in-flight attempt. `watch` begins with a reconnect baseline and streams replacements until a terminal state. `respond` accepts only the current prompt id. `logout` deletes the owning credential record without reading its payload into the response. Host shutdown aborts attempts and closes watchers.

<a id="model-experience"></a>
## Model Experience

None, as this package does not assemble prompts, add messages, or enter the Agent loop.

#### KV Cache effect

None. Authorization state is outside model requests and does not change an established prompt prefix.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The controller deliberately does not choose between authentication backends. A composition selects and registers exactly one flow before requests begin.

The [fusion architecture Agent Note](../../../.agents/notes/implemented/architecture/2026-09-08-deepseek-harness-codex-fusion.md) records that ownership boundary.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Implementation boundary</summary>

The controller is a transport adapter only. Authentication backends own credentials and token refresh, while the Host composition owns backend selection.

</details>
