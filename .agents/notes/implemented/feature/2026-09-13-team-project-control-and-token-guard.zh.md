# Agent Note: Team project control and token guard

Status: implemented

[English](2026-09-13-team-project-control-and-token-guard.md) | 中文

## Problem

Agent Team 可以协调任务，却没有共享的工作模式说明，使产品调研、维护和问题修复混入同一种通用行为。用户还需要一个可见的方法，在长期运行的 Team 消耗更多获准模型用量前停止它，但服务商没有可移植且可靠的统一账户余额接口。

## Decision

Team Lead 在持久 Team 日志中保存具名项目和一个带 revision 的内置预设。预设选择新产品调研、改进现有产品、聚焦的问题修复或自由工作。工具 adapter 会把日志中的选择读入每个 Team member 的 policy，同时保留既有 Team 工具、权限规则、session 与共享任务板。

项目可以包含 Team 级本地 Token 上限与剩余 Token 警告阈值。`TeamProjectControl` 汇总既有 token-meter projection，持久保存每个 member 最近一次服务商报告的累计用量，到达上限时暂停项目、在保留 inbox 的情况下取消 live Team turn，并在 Lead 修改配置前拒绝后续请求。它也会在 HTTP 402 或已识别的明确服务商耗尽 code 时暂停已配置项目；HTTP 429 仍是普通限流。

Web Team panel 是用户控制点。它显示所选预设与克制状态，把测量标为服务商报告的用量或服务商限制信号，而不会称它们为账户余额。`agentTeams/configureProject` Remote method 让项目变更保持显式和持久，不新增第二套 agent loop 或 provider 路径。

Team policy 要求固定交接顺序：结果、证据、变更文件或产物、验证、风险或未解决问题，以及建议的下一步。即使为空，每个部分也必须存在；事实必须与推断分开，接收方在依赖交接前确认未解决风险。

## Alternatives considered

**在每次请求前查询通用服务商余额。** 拒绝，因为 ChatGPT／Codex 与兼容服务商没有可靠的跨服务商余额或重置接口，报告猜测的余额会误导用户。

**在每个服务商错误或 HTTP 429 时停止。** 拒绝，因为短暂限流、超时和传输失败不是额度耗尽的证据。只有本地保护和明确耗尽信号会暂停 Team。

**创建独立的项目管理 runtime。** 拒绝，因为 Team session、task owner、取消和浏览器状态已经有持久 owner。项目控制扩展 Team 日志和 adapter，而不复制它们。

**允许任意完整替换 Team policy。** 拒绝，因为交接、权限、安全和工具契约会变得不可审计。内置预设改变工作模式，而既有安全规则保持完整。

## Consequences

项目与用量日志会随配置变更和用量更新增长，以恢复与审计能力换取隐式内存计量。上限衡量的是 Team member 的报告 Token，而不是货币、隐藏限额或保证的未来重置；用户仍可选择保守的本地阈值。

所选预设使项目意图对所有 Team member 和 panel 可见，固定交接让委派结果更易审查。该能力随 Agent Teams 保持实验性，不启用自主 Team 创建，也不强加 provider／model 选择策略。
