# Agent Note: DeepSeek Harness 与 Codex 的融合边界

Status: implemented

[English](2026-09-08-deepseek-harness-codex-fusion.md) | 中文

## Problem

ChatGPT 认证与 Codex 风格的 Agent 行为很有价值，但引入完整 Codex CLI 或 app-server 会带来第二套 Agent Loop、工具协议、审批系统和会话所有者，也会让 Codex 的原生平台支持成为产品前提，而本产品的兼容性基线是 Windows 10 1709。

## Decision

DeepSeek Harness 继续作为唯一产品运行时。其 Agent Loop、工具、Shell、文件、权限、会话、Remote API、React/Cordis 前端以及 Electron、Node、PowerShell 和打包版本保持权威。

Provider 传输与 Prompt Profile 是两个独立维度。`@deepseek-ai/dsh-prompt-profiles` 在 Provider 外解析 Auto，只改变 persona/工作方式 prompt 层。请求组装原子捕获模型选择，并把实际 Profile 写入请求元数据。ChatGPT/Codex 和官方 OpenAI 默认使用 `codex`，第三方和未知 Provider 默认使用 `deepseek-harness`；手动选择在模型变化后保持不变。

交互式登录复用既有 authorization seam，并通过无秘密的 `@deepseek-ai/dsh-api-authorization-controller` Remote namespace 暴露。`native/codex-auth-sidecar` 下的窄 Rust Sidecar 固定使用 `f326857cf405fb254cf6c8f38766daff074fca6e` 版本的官方 `codex-login` 源码，只通过 stdio JSON-RPC 通信，不包含 Agent Loop、工具或会话逻辑。既有 pi-ai OAuth 继续作为兼容回退。只有通过 Win10 1709 门禁后，发布配置才可选择官方 Sidecar；两个后端不共享或迁移令牌。

会话格式保持 v2。新选择事件属于可忽略的普通事件，请求元数据本来就是可扩展的，所以旧日志天然表示 Auto，没有理由进行重写式迁移。

前端保留当前 slot 与交互拓扑，同时采用温暖中性色、克制的 DeepSeek 蓝、更弱的 chrome、居中可读对话宽度、默认折叠的次要细节，以及拆分的 Model Providers 与 Prompt Profiles 设置。不会复制 Claude.ai 的资产、字体、图标、文案或精确布局。

## 安全与兼容边界

Sidecar 独占认证持久化。访问令牌可为 Provider 请求短暂进入 Host 内存，但不得进入 Renderer 状态、Remote 结果、session JSONL 或诊断日志。Sidecar 启动后不监听网络端口。Windows 发布验收要求 x64 build 16299、二进制导入检查、启动/ping、真实登录与刷新、Codex 与 DeepSeek 请求、PowerShell、文件和会话恢复。Sidecar 失败只能在登录/请求开始前选择回退，并要求重新登录。

## Alternatives considered

**嵌入 Codex CLI 或 app-server。** 否决，因为它会复制 Harness 运行时，并把另一套平台、工具与会话假设纳入 Windows 兼容面。

**合并 Provider 与 Prompt 选择。** 否决，因为这会阻止 DeepSeek API + Codex 行为等受支持组合，并让以后新增 Profile 依赖具体传输。

**把 Sidecar 令牌复制到 Harness 凭据存储。** 否决，因为两个存储会独立刷新和撤销同一个 grant，削弱所有权与退出保证。

**把 session v2 升到 v3。** 否决，因为现有格式明确允许可忽略事件与可扩展请求元数据；格式迁移只会增加失败和审计风险，不改变结构解码。

**重写前端。** 否决，因为既有会话、工作区、工具轨迹、设置、无障碍和经过 Windows 验证的 Electron 基础都是资产。

## Consequences

产品在不替换稳定 Harness 运行时的情况下，获得独立且带版本的行为选择、可确定复现的逐请求元数据、浏览器安全的登录面、官方认证 Sidecar 边界和更安静的对话优先 UI。代价是必须维护与固定 Codex revision 的 Adapter，并在官方 Sidecar 成为发布默认前执行 Windows VM 硬门槛。在门槛通过前，发布的回退后端会明确显示，而不会静默伪装成官方后端。
