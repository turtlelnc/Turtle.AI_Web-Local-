---
description: "与 Provider 解耦、带版本的 Agent 行为 Profile，以及逐会话 Auto/手动选择。"
kind: "package-reference"
---

# @deepseek-ai/dsh-prompt-profiles

[English](README.md) | 中文

## 概述

本包把 Agent 行为与模型传输解耦。它内置 `codex` 和 `deepseek-harness` Profile，基于原子快照的 Provider 解析 Auto 模式，为受约束的 Custom Profile 保留版本，并在每个请求头中记录实际 Profile。它继续复用 Harness 的 Agent Loop、工具、权限、项目指令、Skills、环境和历史；只替换 system prompt 中的 persona/工作方式层。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在会话投影、设置、system-prompt 组装和默认模型服务之后挂载。Auto 将 ChatGPT/Codex 与官方 OpenAI 路由映射到 Codex 行为，将 DeepSeek、兼容端点和未知路由映射到 Harness 行为。手动选择不会随模型切换而改变。

Custom Profile 必须继承一个内置基线，只能追加指令或选择进度/详略风格。编辑会追加不可变 revision；既有会话在明确重新选择前继续引用旧 revision。

<a id="model-experience"></a>
## 模型体验

### 当前 Prompt Profile

#### 模型看到什么

解析后的 Profile 会替换 `persona-prefix` 工作方式层；会话中途切换还会在下一次请求前加入一条简短的 user-role 连续性说明。

#### Token 影响

每次请求包含一个内置基线、所选 `additionalInstructions` 和明确的进度/详略行为；工具、权限、项目、Skills、环境和历史 token 不变。

#### KV Cache 影响

实际 Profile 变化会改变 system-prompt 前缀，因此开始新的请求系列。重复选择同一个 Profile 是无操作，会保留现有系列。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

- Custom Profile 不能替换工具 schema、安全策略、权限、环境或会话协议。
- 删除 Custom Profile 只会从目录隐藏它；会话历史引用的 revision 仍会保留。
- `prompt-profile/selection` 是 v2 中可忽略的普通事件。旧 v2 日志天然表示 Auto，`request/header.metadata.promptProfile` 则记录准确的实际 revision。

[融合架构 Agent Note](../../../.agents/notes/implemented/architecture/2026-09-08-deepseek-harness-codex-fusion.zh.md)记录了该边界决策。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>Revision 所有权</summary>

该服务拥有不可变 Profile revision 和请求时解析；Provider 只提供传输事实，绝不选择 Profile。

</details>
