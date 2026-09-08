# Customize product branding

English | [中文](branding.zh.md)

Use build-time branding when you distribute DeepSeek Harness under another product name. An ordinary checkout keeps the DeepSeek Harness name, fish mark, and localized welcome headline.

## Customize the Web UI

Place your icon in [`apps/web/public`](../../../apps/web/public/) so the built application can serve it, then set these public build variables before running `pnpm run build`:

```sh
export DSH_CLIENT_TITLE='My Harness'
export DSH_CLIENT_ICON_URL='/my-harness.svg'
export DSH_CLIENT_WELCOME_TEXT='What would you like to build?'
pnpm run build
```

`DSH_CLIENT_TITLE` controls the browser title, sidebar product name, and installed Web app name. `DSH_CLIENT_ICON_URL` controls the browser icon, sidebar mark, empty-conversation mark, and installed Web app icon. `DSH_CLIENT_WELCOME_TEXT` replaces the localized empty-conversation headline. An omitted or empty variable uses the built-in DeepSeek Harness value.

These values become public client artifact content. Rebuild after changing them; do not put secrets in any `DSH_CLIENT_*` variable.

## Customize the desktop package

The desktop package has two additional fields:

```sh
export DSH_DESKTOP_PRODUCT_NAME='My Harness'
export DSH_DESKTOP_ICON='/absolute/path/to/my-harness.icns'
pnpm run package:desktop:mac:arm64
```

Use an `.ico` file for a Windows package and an `.icns` file for a macOS package. Set the three Web UI variables in the same shell when the packaged renderer must use the matching name, icon, and welcome headline. The existing release signing variables and platform-specific build-host requirements still apply; the [desktop reference](../../../apps/desktop/README.md) owns those requirements.

## Restore the defaults

Unset the five variables and rebuild. The application returns to the DeepSeek Harness name, built-in fish mark, and localized `Into the Unknown` or `探索未至之境` welcome headline.
