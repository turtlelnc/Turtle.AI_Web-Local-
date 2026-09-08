---
description: "用于 Host 所有交互式认证尝试的无秘密 Remote 控制面。"
kind: "package-reference"
---

# @deepseek-ai/dsh-api-authorization-controller

[English](README.md) | 中文

## 目录

- [概述](#summary)
- [行为](#behavior)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="summary"></a>
## 概述

本 Host 服务通过标准 Remote 协议提供 `authorization.list/begin/respond/cancel/watch/logout`。尝试、取消、提示与凭据始终由 Host 持有。浏览器响应只包含流程元数据、安全通知、提示描述和终态；访问令牌与刷新令牌绝不返回。

<a id="behavior"></a>
## 行为

`begin` 会拒绝未知方法或第二个并发尝试；`watch` 先给出可重连基线，再推送替换状态直到终态；`respond` 只接受当前 prompt id；`logout` 删除所属凭据记录，但不会把 payload 读入响应。Host 退出时会中止尝试并关闭 watcher。

<a id="model-experience"></a>
## 模型体验

无，因为本包不组装 prompt、不添加消息，也不进入 Agent Loop。

#### KV Cache 影响

无。认证状态位于模型请求之外，不会改变已经建立的 prompt 前缀。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

- 控制器有意不选择认证后端。产品组合必须在请求开始前选择并注册唯一流程。

[融合架构 Agent Note](../../../.agents/notes/implemented/architecture/2026-09-08-deepseek-harness-codex-fusion.zh.md)记录了该所有权边界。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>实现边界</summary>

该控制器只承担传输适配。认证后端负责凭据和令牌刷新，Host 产品组合负责选择后端。

</details>
