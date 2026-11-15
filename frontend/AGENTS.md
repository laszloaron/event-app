# frontend/AGENTS.md – React rules

Applies on top of the root [AGENTS.md](../AGENTS.md).

## Stack
- React + **TypeScript** (strict) built with Vite; `npm run build` runs `tsc --noEmit` first, so type errors fail the image build.
- Served by nginx (`nginx.conf`): `/api/*` is proxied to `backend:8000`, and every other path falls back to `index.html` (Single Page Application routing).
- Add a dependency (e.g. Leaflet for US-01) only when a story needs it, and record the reason in `docs/architecture.md`.

## Conventions
- All HTTP calls go through `src/api/<resource>.ts`, which exports fetch functions. Components never call `fetch` directly.
- Request/response types for `/api/v1` come from the generated `src/api/schema.d.ts` (`import type { EventDetailOut } from "./schema"`), never hand-written. Never edit `schema.d.ts` or `openapi.json`; regenerate with `scripts/gen-api.sh` / `scripts\gen-api.ps1` (architecture.md §3 "Typed client"). Only the unversioned `/api/health` keeps a hand-written type.
- Always use same-origin relative URLs (`/api/...`). There is no base-URL config and no CORS (architecture.md §1).
- Times: the API returns UTC ISO strings plus the event `timezone`; format them with `Intl.DateTimeFormat(…, { timeZone })`.
- Mobile-first layout.

## Tests
Reading and writeing the test folder is prohibited, if you are working on the code, and if you are working on the tests, the other folders are prohibited! 

## Commands
```bash
npm install && npm run dev   # dev server on :5173, proxies /api to localhost:8000
npm run build                # check generated API types are current, type-check, build into dist/
npm run gen:api              # openapi.json -> src/api/schema.d.ts (scripts/gen-api.* also refreshes openapi.json)
```
`package-lock.json` is committed; the Docker build uses `npm ci`.
