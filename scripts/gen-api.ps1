# Regenerate the frontend's API types from the backend (architecture.md §3 "Typed client"):
#   backend schemas -> frontend\openapi.json -> frontend\src\api\schema.d.ts
# Run after changing any backend schema or endpoint, and commit both generated files.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

function Invoke-Checked([scriptblock]$Command) {
    & $Command
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

# Rebuild first: the image has no bind mount, so a running container may hold old code.
Invoke-Checked { docker compose up -d --build --wait db backend }
# The file is written inside the container and copied out with `docker compose cp`,
# because PowerShell 5.1 redirection (`>`) would re-encode the JSON as UTF-16.
Invoke-Checked { docker compose exec -T backend python manage.py export_openapi --output /tmp/openapi.json }
Invoke-Checked { docker compose cp backend:/tmp/openapi.json frontend/openapi.json }

Set-Location frontend
Invoke-Checked { npm run gen:api }
Write-Host 'Updated frontend\openapi.json and frontend\src\api\schema.d.ts'
