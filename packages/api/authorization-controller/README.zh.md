---
description: "用于 Host 所有交互式认证尝试的无秘密 Remote 控制面。"
kind: "package-reference"
---

# @deepseek-ai/dsh-api-authorization-controller

[English](README.md) | 中文

## 摘要

本 Host 服务通过标准 Remote 协议提供 `authorization.list/begin/respond/cancel/watch/logout`。尝试、取消、提示与凭据始终由 Host 持有。浏览器响应只包含流程元数据、安全通知、提示描述和终态；访问令牌与刷新令牌绝不返回。

## 行为

`begin` 会拒绝未知方法或第二个并发尝试；`watch` 先给出可重连基线，再推送替换状态直到终态；`respond` 只接受当前 prompt id；`logout` 删除所属凭据记录，但不会把 payload 读入响应。Host 退出时会中止尝试并关闭 watcher。

## 模型体验

无，因为本包不组装 prompt、不添加消息，也不进入 Agent Loop。

#### KV Cache 影响

无。认证状态位于模型请求之外，不会改变已经建立的 prompt 前缀。

## 已知限制与延后工作

控制器有意不选择认证后端。产品组合必须在请求开始前选择并注册唯一流程。

[融合架构 Agent Note](../../../.agents/notes/implemented/architecture/2026-09-08-deepseek-harness-codex-fusion.zh.md)记录了该所有权边界。
