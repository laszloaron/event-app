#!/usr/bin/env sh
# Regenerate the frontend's API types from the backend (architecture.md §3 "Typed client"):
#   backend schemas -> frontend/openapi.json -> frontend/src/api/schema.d.ts
# Run after changing any backend schema or endpoint, and commit both generated files.
set -e
cd "$(dirname "$0")/.."
# Git Bash on Windows would rewrite the container path /tmp/... into a Windows path.
export MSYS_NO_PATHCONV=1

# Rebuild first: the image has no bind mount, so a running container may hold old code.
docker compose up -d --build --wait db backend
docker compose exec -T backend python manage.py export_openapi --output /tmp/openapi.json
docker compose cp backend:/tmp/openapi.json frontend/openapi.json

cd frontend
npm run gen:api
echo "Updated frontend/openapi.json and frontend/src/api/schema.d.ts"
