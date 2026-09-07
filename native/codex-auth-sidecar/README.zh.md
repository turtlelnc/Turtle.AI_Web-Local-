# codex-auth-sidecar

[English](README.md) | 中文

这个可选的 Windows x64 辅助程序封装固定在 Codex revision `f326857cf405fb254cf6c8f38766daff074fca6e` 的官方 `codex-login` crate。它独占一个认证目录，只通过换行分隔的 stdio JSON-RPC 提供浏览器登录、设备码登录、脱敏状态、Host 内存令牌读取和退出。它不会开启面向产品的网络监听；浏览器 PKCE 登录期间由 `codex-login` 创建的 localhost server 只在该次尝试中存在。

发布构建有意使用文件持久化的 Codex 凭据，而不依赖 Windows keyring，从而缩小必须通过 Windows 10 1709 导入检查的 Win32 API 表面。只有 `scripts/check-codex-auth-sidecar-win32.ps1` 在真实 1709 x64 镜像上通过后，该可执行文件才可成为发布默认后端。
