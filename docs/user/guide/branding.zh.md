# 自定义产品品牌

[English](branding.md) | 中文

以其他产品名称发布 DeepSeek Harness 时，可以使用构建期品牌配置。普通检出默认保留 DeepSeek Harness 名称、鱼形标志和本地化欢迎词。

## 自定义 Web UI

把图标放进 [`apps/web/public`](../../../apps/web/public/)，使构建后的应用可以提供该文件，然后在运行 `pnpm run build` 前设置以下公开构建变量：

```sh
export DSH_CLIENT_TITLE='My Harness'
export DSH_CLIENT_ICON_URL='/my-harness.svg'
export DSH_CLIENT_WELCOME_TEXT='What would you like to build?'
pnpm run build
```

`DSH_CLIENT_TITLE` 控制浏览器标题、侧栏产品名称和已安装 Web 应用名称。`DSH_CLIENT_ICON_URL` 控制浏览器图标、侧栏标志、空对话标志和已安装 Web 应用图标。`DSH_CLIENT_WELCOME_TEXT` 替换本地化的空对话欢迎词。省略变量或将其留空时，应用使用内置 DeepSeek Harness 值。

这些值会成为公开客户端构建产物的一部分。修改后必须重新构建；不要把秘密放进任何 `DSH_CLIENT_*` 变量。

## 自定义桌面安装包

桌面安装包还提供两个字段：

```sh
export DSH_DESKTOP_PRODUCT_NAME='My Harness'
export DSH_DESKTOP_ICON='/absolute/path/to/my-harness.icns'
pnpm run package:desktop:mac:arm64
```

Windows 安装包使用 `.ico` 文件，macOS 安装包使用 `.icns` 文件。如果安装包内的渲染界面也要使用匹配的名称、图标和欢迎词，请在同一个 shell 中设置三个 Web UI 变量。现有发布签名变量和平台专用构建主机要求仍然适用；这些要求由[桌面端参考文档](../../../apps/desktop/README.zh.md)统一说明。

## 恢复默认值

取消设置这五个变量并重新构建。应用会恢复 DeepSeek Harness 名称、内置鱼形标志，以及本地化的 `Into the Unknown` 或 `探索未至之境` 欢迎词。
