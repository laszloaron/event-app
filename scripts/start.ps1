# Build and start the EventMap stack, streaming all container logs into
# logs\eventapp_<YYYYMMDD-HHMMSS>.log (one file per start, see AGENTS.md "Logging").
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host 'Created .env from .env.example'
}

New-Item -ItemType Directory -Force logs | Out-Null
$logFile = "logs\eventapp_$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

docker compose up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Detached streamer using cmd redirection (in PS 5.1, Tee-Object would write UTF-16).
# It exits on its own when the stack is stopped with `docker compose down`.
Start-Process -WindowStyle Hidden -FilePath cmd.exe `
    -ArgumentList '/c', "docker compose logs -f --timestamps --no-color > `"$logFile`" 2>&1"

Write-Host "Logs:     $logFile"
Write-Host 'App:      http://localhost'
Write-Host 'Health:   http://localhost/api/health'
Write-Host 'API docs: http://localhost/api/v1/docs'
