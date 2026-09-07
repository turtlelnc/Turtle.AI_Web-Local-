# codex-auth-sidecar

English | [中文](README.zh.md)

This optional Windows x64 helper wraps the official `codex-login` crate pinned
to Codex revision `f326857cf405fb254cf6c8f38766daff074fca6e`. It owns a
dedicated auth directory and exposes only newline-delimited stdio requests for
browser login, device login, redacted status, in-memory token retrieval, and
logout. It never opens a product-facing network listener; the localhost server
used during browser PKCE login is created by `codex-login` and exists only for
that attempt.

The release build intentionally uses file-backed Codex credentials rather than
Windows keyring integration. This reduces the Win32 API surface that must pass
the Windows 10 1709 import gate. The executable is not a release default until
the checks in `scripts/check-codex-auth-sidecar-win32.ps1` pass on a real 1709
x64 image.
