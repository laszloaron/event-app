# frontend/AGENTS.md – React rules

Applies on top of the root [AGENTS.md](../AGENTS.md).

## Stack
- React + **TypeScript** (strict) built with Vite; `npm run build` runs `tsc --noEmit` first, so type errors fail the image build.
- Served by nginx (`nginx.conf`): `/api/*` is proxied to `backend:8000`, and every other path falls back to `index.html` (Single Page Application routing).
- Add a dependency (e.g. Leaflet for US-01) only when a story needs it, and record the reason in `docs/architecture.md`.

## Folder structure
```
src/
  styles/            tokens.css (every colour/size/timing, ui_design.md §2), base.css (reset, type classes, focus ring)
  components/ui/     reusable primitives + composites (Button, TextField, Sheet, Dialog, ListRow…), ui.css, `ui-` classes
  components/domain/ EventMap-specific parts (EventRow, EventCard, EventMap, FilterSheet, InboxRow…), domain.css, `d-` classes
  components/layout/ AppShell: TabBar (phone) / NavRail (desktop), `l-` classes
  pages/             one file per screen (§5) + pages.css, `p-` classes; screens only arrange components
  routing/           URL helpers (§8): card overlay, safe `next`, back with fallback
  session/           logged-in user from GET /me, login/register/logout, role helpers (`can.*`)
  hooks/             useApi + refresh after writes, toast, search area (GPS/city), filters in the URL, sports
  utils/             display formatting, time-zone conversion, event form rules (US-09 saving rules)
  api/               client.ts (the only `fetch`: CSRF, `{detail, field}` → ApiError), one file per resource, generated schema.d.ts
```
- Import components only through `components/ui` and `components/domain` (their `index.ts`).
- Routes live in `App.tsx` and follow ui_design.md §8.1; the event card is drawn over `state.background`. Access rules (§8.5) live in its `Guard`.
- Show/hide actions from the API's `viewer` flags and `/me` role, never by re-implementing a permission rule (architecture.md §3).
- After a successful write call `useRefresh()()` so every open screen reloads (the card sits over other screens, US-11).

## Conventions
- All HTTP calls go through `src/api/<resource>.ts`, which exports fetch functions. Components never call `fetch` directly.
- Request/response types for `/api/v1` come from the generated `src/api/schema.d.ts` (`import type { EventDetailOut } from "./schema"`), never hand-written. Never edit `schema.d.ts` or `openapi.json`; regenerate with `scripts/gen-api.sh` / `scripts\gen-api.ps1` (architecture.md §3 "Typed client"). Only the unversioned `/api/health` keeps a hand-written type.
- Always use same-origin relative URLs (`/api/...`). There is no base-URL config and no CORS (architecture.md §1).
- Times: the API returns UTC ISO strings plus the event `timezone`; format them with `Intl.DateTimeFormat(…, { timeZone })`.
- Mobile-first layout. Look & layout follow [docs/ui_design.md](../docs/ui_design.md): use only its tokens and shared components; screens never style their own buttons, tags or fields.

## Tests
Reading and writeing the test folder is prohibited, if you are working on the code, and if you are working on the tests, the other folders are prohibited! 

## Commands
```bash
npm install && npm run dev   # dev server on :5173, proxies /api to localhost:8000
npm run build                # check generated API types are current, type-check, build into dist/
npm run gen:api              # openapi.json -> src/api/schema.d.ts (scripts/gen-api.* also refreshes openapi.json)
```
`package-lock.json` is committed; the Docker build uses `npm ci`.
