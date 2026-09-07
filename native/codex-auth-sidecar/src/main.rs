//! Narrow stdio bridge around the pinned official `codex-login` crate.

use std::io;
use std::path::{Path, PathBuf};

use base64::Engine;
use codex_http_client::{HttpClientFactory, OutboundProxyPolicy};
use codex_login::{
    AuthCredentialsStoreMode, AuthKeyringBackendKind, AuthRouteConfig, CLIENT_ID, ServerOptions,
    complete_device_code_login, load_auth_dot_json, logout_with_revoke, request_device_code,
    run_login_server,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

const PINNED_CODEX_REVISION: &str = "f326857cf405fb254cf6c8f38766daff074fca6e";

#[derive(Deserialize)]
struct Request {
    id: Value,
    method: String,
    #[serde(default)]
    params: Params,
}

#[derive(Default, Deserialize)]
struct Params {
    codex_home: Option<PathBuf>,
}

#[derive(Serialize)]
struct Response {
    jsonrpc: &'static str,
    id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
}

#[derive(Serialize)]
struct JsonRpcError {
    code: i32,
    message: String,
}

fn other(error: impl std::fmt::Display) -> io::Error {
    io::Error::other(error.to_string())
}

fn route_config() -> AuthRouteConfig {
    AuthRouteConfig::from_http_client_factory(HttpClientFactory::new(
        OutboundProxyPolicy::ReqwestDefault,
    ))
}

fn options(codex_home: PathBuf) -> ServerOptions {
    ServerOptions::new(
        codex_home,
        CLIENT_ID.to_string(),
        None,
        AuthCredentialsStoreMode::File,
        AuthKeyringBackendKind::Direct,
        route_config(),
    )
}

fn home(params: &Params) -> io::Result<PathBuf> {
    params
        .codex_home
        .clone()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "codex_home is required"))
}

fn token_expiry_ms(token: &str) -> Option<i64> {
    let payload = token.split('.').nth(1)?;
    let decoded = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(payload)
        .ok()?;
    serde_json::from_slice::<Value>(&decoded)
        .ok()?
        .get("exp")?
        .as_i64()
        .and_then(|seconds| seconds.checked_mul(1000))
}

fn auth_view(codex_home: &Path, include_tokens: bool) -> io::Result<Value> {
    let auth = load_auth_dot_json(
        codex_home,
        AuthCredentialsStoreMode::File,
        AuthKeyringBackendKind::Direct,
    ).map_err(other)?;
    let Some(tokens) = auth.and_then(|auth| auth.tokens) else {
        return Ok(json!({ "configured": false }));
    };
    let mut value = json!({
        "configured": true,
        "accountId": tokens.account_id,
        "workspaceId": tokens.id_token.chatgpt_account_id,
        "email": tokens.id_token.email,
        "plan": tokens.id_token.get_chatgpt_plan_type(),
        "expires": token_expiry_ms(&tokens.access_token),
    });
    if include_tokens {
        value["access"] = Value::String(tokens.access_token);
        value["refresh"] = Value::String(tokens.refresh_token);
    }
    Ok(value)
}

async fn write_line(stdout: &mut tokio::io::Stdout, value: Value) -> io::Result<()> {
    stdout.write_all(serde_json::to_string(&value).map_err(other)?.as_bytes()).await?;
    stdout.write_all(b"\n").await?;
    stdout.flush().await
}

async fn handle(request: &Request, stdout: &mut tokio::io::Stdout) -> io::Result<Value> {
    match request.method.as_str() {
        "ping" => Ok(json!({
            "backend": "codex-login",
            "codexRevision": PINNED_CODEX_REVISION,
            "protocol": 1,
        })),
        "status" => auth_view(&home(&request.params)?, false),
        "tokens" => auth_view(&home(&request.params)?, true),
        "login_browser" => {
            let server = run_login_server(options(home(&request.params)?)).map_err(other)?;
            write_line(stdout, json!({
                "jsonrpc": "2.0",
                "method": "authorization/notice",
                "params": {
                    "message": "Open this page to continue signing in.",
                    "url": server.auth_url,
                },
            })).await?;
            server.block_until_done().await.map_err(other)?;
            auth_view(&home(&request.params)?, false)
        }
        "login_device" => {
            let opts = options(home(&request.params)?);
            let device = request_device_code(&opts).await.map_err(other)?;
            write_line(stdout, json!({
                "jsonrpc": "2.0",
                "method": "authorization/notice",
                "params": {
                    "message": "Enter this code on the verification page to finish signing in.",
                    "url": device.verification_url,
                    "code": device.user_code,
                },
            })).await?;
            complete_device_code_login(opts, device).await.map_err(other)?;
            auth_view(&home(&request.params)?, false)
        }
        "logout" => {
            let changed = logout_with_revoke(
                &home(&request.params)?,
                AuthCredentialsStoreMode::File,
                AuthKeyringBackendKind::Direct,
                &route_config(),
            ).await.map_err(other)?;
            Ok(json!({ "changed": changed }))
        }
        method => Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("unknown method: {method}"),
        )),
    }
}

#[tokio::main]
async fn main() -> io::Result<()> {
    let mut lines = BufReader::new(tokio::io::stdin()).lines();
    let mut stdout = tokio::io::stdout();
    while let Some(line) = lines.next_line().await? {
        let request: Request = match serde_json::from_str(&line) {
            Ok(request) => request,
            Err(error) => {
                write_line(&mut stdout, json!({
                    "jsonrpc": "2.0",
                    "id": null,
                    "error": { "code": -32700, "message": error.to_string() },
                })).await?;
                continue;
            }
        };
        let response = match handle(&request, &mut stdout).await {
            Ok(result) => Response {
                jsonrpc: "2.0", id: request.id, result: Some(result), error: None,
            },
            Err(error) => Response {
                jsonrpc: "2.0",
                id: request.id,
                result: None,
                error: Some(JsonRpcError { code: -32000, message: error.to_string() }),
            },
        };
        write_line(&mut stdout, serde_json::to_value(response).map_err(other)?).await?;
    }
    Ok(())
}
