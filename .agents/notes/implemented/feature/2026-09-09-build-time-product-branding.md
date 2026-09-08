# Agent Note: Build-time product branding

Status: implemented

English | [中文](2026-09-09-build-time-product-branding.zh.md)

## Problem

The browser shell had separate fixed values for its local-build label, empty-conversation headline, favicon, Web app manifest, and desktop package identity. A downstream distributor had to edit several unrelated source files to present one consistent product identity, and an unprofiled local build displayed `DSH Local Build` even though the product remained DeepSeek Harness.

## Decision

The default client identity is DeepSeek Harness in profiled and unprofiled builds. Three public build variables provide one renderer-wide override: `DSH_CLIENT_TITLE` sets the document, sidebar, and Web app title; `DSH_CLIENT_ICON_URL` sets the document, sidebar, hero, and Web app mark; and `DSH_CLIENT_WELCOME_TEXT` sets the empty-conversation headline. Empty values retain the built-in name, fish mark, and locale-owned headline.

The official client build profile accepts only these three deliberate brand overrides in addition to its fixed build metadata. The complete client build record captures their exact values, so release packaging verifies the same branded artifacts it consumes. Other inherited `DSH_CLIENT_*` values remain excluded from that profile.

Electron packaging reads `DSH_DESKTOP_PRODUCT_NAME` and `DSH_DESKTOP_ICON` for native package metadata. These fields do not alter the renderer; a distributor sets the client variables in the same packaging environment when both layers need the same identity.

## Alternatives considered

**Store branding in user settings.** Runtime settings can change rendered text but cannot consistently change the initial HTML, install manifest, executable metadata, or signed application icon. It would also make one installed artifact present different publisher identities per user.

**Require direct source edits.** Editing every consumer keeps the build system smaller but creates inconsistent partial rebrands and makes upstream updates harder to integrate.

**Replace the slot system.** Sidebar and hero slots remain useful for plugin-owned presentation. Build variables supply deployment defaults without introducing a second runtime composition mechanism.

## Consequences

Brand changes require a client rebuild and, for native metadata, a new signed desktop package. Every `DSH_CLIENT_*` value is public artifact content and cannot hold a secret. A custom image URL must resolve from the deployed application, while desktop icon input must use the format required by its target platform.
