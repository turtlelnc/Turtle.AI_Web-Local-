param(
  [Parameter(Mandatory = $true)]
  [string]$Path
)

$ErrorActionPreference = 'Stop'

if (-not [Environment]::Is64BitOperatingSystem) {
  throw 'Windows 10 1709 x64 is required for the compatibility gate.'
}

$version = [Environment]::OSVersion.Version
if ($version.Major -ne 10 -or $version.Build -ne 16299) {
  throw "This hard gate must run on Windows 10 1709 (build 16299); detected $version."
}

if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
  throw "Sidecar executable not found: $Path"
}

$request = '{"id":1,"method":"ping","params":{}}'
$result = $request | & $Path | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $result.error -or $result.result.protocol -ne 1) {
  throw 'Sidecar startup/ping failed.'
}

$dumpbin = Get-Command dumpbin.exe -ErrorAction SilentlyContinue
if ($dumpbin) {
  $imports = & $dumpbin.Source /imports $Path
  $blocked = @('api-ms-win-core-path-l1-1-0.dll')
  foreach ($name in $blocked) {
    if ($imports -match [regex]::Escape($name)) {
      throw "Unsupported Win32 import detected: $name"
    }
  }
} else {
  Write-Warning 'dumpbin.exe is unavailable; startup passed but PE import inspection was skipped.'
}

Write-Output 'codex-auth-sidecar passed the Windows 10 1709 startup/import gate.'
