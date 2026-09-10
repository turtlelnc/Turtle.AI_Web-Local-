# Agent Note: Flash-first 升级 Profile

Status: implemented

[English](2026-09-10-flash-first-escalation-profile.md) | 中文

## Problem

如果大型项目生命周期中的每个任务、审查或重复代码阅读都使用最强模型，就会浪费高级模型额度。缺少结构的委派还会重复传递上下文、遗漏证据，并使父 Agent 无法区分子 Agent 的事实与推断。

## Decision

Prompt Profile 目录包含手动选择的 `flash-first` Profile。它使用 DeepSeek Harness 基础行为，让父模型默认承担常规调研、概念验证、实现、测试、文档、打包和维护。基础组合继续使用 DeepSeek-V4-Flash 作为与传输无关的默认模型。

该 Profile 仅在高影响决策、多轮证据式调试仍未解决、证据矛盾、复杂状态或并发、里程碑批量审查、发布审计或有价值的独立专家审查时，通过现有可选模型的 `subagent` 工具升级。它要求父 Agent 查询已授权的子模型目录，并选择明确能胜任任务的最低成本路由。Provider 配置与 Subagent 模型白名单继续独立于该 Profile。

每次升级都携带紧凑请求，其中包含任务、决策或问题、成功标准、约束、已验证事实、尝试及结果、权限范围和期望返回。每个子 Agent 的响应分别给出结论、证据、风险与未知项、建议动作、受影响的文件或接口以及验证方式。父 Agent 验证并整合结果，对最终结果继续负责。

Auto Provider 映射保持不变：DeepSeek 与兼容路由解析为 `deepseek-harness`，官方 OpenAI 与 ChatGPT/Codex 路由解析为 `codex`。用户显式选择 `flash-first`，因此 Provider 变化不会静默安装成本路由策略。

## Alternatives considered

**让 Flash-first 成为 DeepSeek Auto Profile。** 未采用，因为 Provider 身份不代表用户的预算策略，而且这会削弱既有的 Provider/Profile 独立保证。

**构建隐藏的自动模型路由器。** 未采用，因为模型目录、凭证、价格和用户授权路由随部署而变化。现有白名单以及显式的 `provider` 与 `model` 工具参数让选择保持可见并可审计。

**把完整对话发送给每个更强模型。** 未采用，因为这会重复消耗 token，并掩盖哪些证据支持被委派的问题。固定交接标题要求有边界且可审查的上下文包。

**每个任务都运行高级模型审查。** 未采用，因为常规工作已有确定性的构建、测试和日志证据。按里程碑批量审查以更低成本保留独立检查。

## Consequences

用户可以组合 DeepSeek-V4-Flash 父模型与更强的已授权子 Agent，而无需把提示词与传输耦合。固定交接协议减少重复上下文，并让结论可审计。该策略仍是由模型可见指令实施的指导，而不是成本计量器，因此用户必须配置白名单，并为目标会话选择该 Profile。
