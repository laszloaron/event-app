# EventMap – High-level architecture, data model & API plan

## Context
EventMap is built as a containerised app — **nginx (+ built React SPA)**, **Django + Django Ninja + GeoDjango under gunicorn**, **Postgres/PostGIS** — run with Docker Compose. This document fixes the architecture, the data model and the REST API, all derived from [specification.md](specification.md) and the user stories US-01…US-25 in [user_stories.md](user_stories.md). Every decision carries a short *grounding* explaining why it was made.

---

## 1. Runtime architecture

```
Browser ──HTTPS/HTTP──► nginx  (only published port, 80)
                         ├── /            → React build (try_files … /index.html)
                         └── /api/*       → proxy_pass http://backend:8000
                                            backend: gunicorn → Django/Ninja/GeoDjango
                                                        └──► db: postgis/postgis:16-3.4 (5432, internal only)
```

| Decision | Grounding |
|---|---|
| DB image = **postgis/postgis** (not plain postgres) | GeoDjango's spatial lookups (`distance_lte`, `dwithin`) need the PostGIS extension; plain postgres can't do US-01/US-02 radius queries. |
| Single origin (SPA and API both behind nginx) | No CORS config, cookies work natively, matches the given diagram. |
| **Session-cookie auth** (Django sessions + CSRF), Ninja `django_auth` | Same origin ⇒ httpOnly cookie is simplest and safer than JWT in localStorage; Django gives login/logout/password hashing for free. |
| `try_files $uri /index.html` in nginx | US-11 needs shareable deep links (`/events/42`) that must load the SPA. |
| Two compose networks: `public` (nginx↔backend), `internal` (backend↔db) | DB never reachable from nginx/host; least privilege. |
| No Redis/Celery/worker container | Notifications are in-app only (US-22) and written in the same DB transaction; "within 1 minute" (US-09/16) is met by synchronous writes. Fewer moving parts for a homework scope. |
| "Ended" is computed (`end_at < now()`), not a status set by a job | US-01/07/23 hide ended events; a computed rule needs no cron and can never be stale. |
| Clustering (US-13) done **client-side** (Leaflet + markercluster) | Clustering depends on zoom level, which only the client knows; single launch city ⇒ result sets are small enough to return in full. |
| Map tiles: OpenStreetMap via Leaflet; no API key | Free, no secret management; venue pin (form) uses same map. |
| City lookup (US-04) = seeded `City` table, not an external geocoder | Spec: single launch region; deterministic "City not found"; no third-party dependency/rate limits. |
| Logging: containers log to stdout; `scripts/start.*` streams `docker compose logs -f` into `logs/eventapp_<timestamp>.log` (one file per start) | Gathers every container into one file without a 4th log-collector container or per-image log config; each line keeps the service name. |

### Compose services
- **db**: `postgis/postgis:16-3.4`, volume `pgdata`, env from `.env`, healthcheck `pg_isready`.
- **backend**: `python:3.12-slim-trixie` + `gdal-bin` (pulls the GDAL/GEOS/PROJ runtime libs); entrypoint: `migrate` → `loaddata cities sports` → `gunicorn config.wsgi -w 3 -b 0.0.0.0:8000` (access/error log to stdout). `depends_on: db: service_healthy`; healthcheck calls `/api/health`. Not port-published.
  - Grounding for no `-dev` packages: GeoDjango loads GDAL/GEOS through ctypes and nothing is compiled against their headers, so runtime libraries are enough and the image is smaller. Pinned Debian release keeps the apt package set reproducible; trixie (not bookworm) because it ships GDAL ≥ 3.9, which Django requires to block file/network access from spatial input (system check `gis.W001`).
- **frontend**: multi-stage Dockerfile — `node:20` builds the Vite **React + TypeScript** app → `nginx:1.27-alpine` serves `/usr/share/nginx/html` + `nginx.conf`. Publishes `80:80`. `depends_on: backend: service_healthy`.
  - Grounding for TypeScript: mirrors the repo rule "type hints on every signature" and lets API response shapes be typed.
- `.env.example`: `POSTGRES_*`, `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`.
- Optional `docker-compose.override.yml` for dev (Vite dev server + `runserver`, bind mounts).

### Repo layout
```
eventapp/
  docker-compose.yml  .env.example  scripts/ (start.sh, start.ps1)  logs/ (git-ignored)
  frontend/  Dockerfile  nginx.conf  package.json  src/…
  backend/   Dockerfile  entrypoint.sh  requirements.txt  manage.py
    config/        settings.py urls.py wsgi.py api.py (NinjaAPI root, mounts routers)
    common/        permission helpers, change-diff util, shared base classes
    accounts/      User, OrganizerRequest, auth + account routers
    events/        Sport, City, Event, RSVP, PaidMark, routers, services (validation, notify)
    inbox/         Notification, router
    moderation/    AuditLog, admin routers
    test/          all backend tests
```
Each domain app is split into `models.py` / `selectors.py` (reads) / `services.py` (writes, business rules) / `schemas.py` (Ninja I/O) / `views.py` (thin routers).
All backend tests live in one folder, `backend/test/` (files `test_<layer>_<app>.py`). Grounding: one place to find every test; it sits inside `backend/` so it ships in the image and `manage.py test` discovers it without extra mounts.
Grounding: one Django app per bounded area from the user-story sections (discover/attend/organize/admin) keeps routers and permissions local; separating reads, writes and I/O keeps views thin and business rules testable without HTTP.

---

## 2. Data model (Django / GeoDjango)

**User** (`accounts.User(AbstractUser)`) — custom from day one (Django recommends it; changing later is painful)
- `role`: enum `attendee | organizer | admin` (default attendee)
- Grounding: roles are mutually-exclusive tiers (organizer ⊇ attendee; admin excludes both, US-19) — a single enum is simpler to check than groups.

**OrganizerRequest** — US-20/21
- `user FK`, `status pending|approved|rejected`, `created_at`, `decided_by FK User null`, `decided_at null`
- Partial unique constraint: one `pending` per user.

**Sport** (generic category per spec §5)
- `name`, `slug unique`, `kind` (`sport`, future `tech`…), `icon`

**City** — US-04
- `name`, `name_normalized unique` (lower/unaccented), `center PointField(geography=True)`, `timezone` (e.g. `Europe/Budapest`)

**Event**
- `organizer FK User`, `status draft|published|cancelled`
- `title` (3–100), `sport FK null`, `start_at`, `end_at` (timestamptz, UTC) — nullable at DB level for drafts
- `venue_name`, `venue_address`, `location PointField(geography=True, srid=4326) null`, `timezone` (default city tz)
- `price_amount Decimal null`, `price_currency char(3) null` → null amount = "Free"
- optional: `description`, `sport_explainer`, `ticket_url`, `registration_url`, `capacity PositiveInt null`, `social_links JSON` (list of `{label,url}`)
- `cancel_reason null`, `cancelled_by FK null`, `published_at`, `created_at`, `updated_at`
- Indexes: GiST on `location`; btree on `(status, start_at)`, `(status, end_at)`; `organizer`.
- Constraints: `CHECK end_at > start_at`, `CHECK capacity > 0`, `CHECK ticket_url = '' OR price_amount IS NOT NULL`, `CHECK (price_amount IS NULL) = (price_currency = '')`, `CHECK price_amount > 0`. Each CHECK lets NULL through so drafts save.
  - Grounding for the two price CHECKs: the form requires "Free" or "an amount with a currency" (US-09), so amount and currency come as a pair; null is the only way to say Free, so 0 is rejected.
  - Text columns are `blank` (`''`), never `NULL`: Django convention, one empty value.
- Groundings: *drafts share the table* — US-25 reopens a draft in the same form and publishes it in place; *required fields nullable* — US-09 lets incomplete drafts save, publish-time validation enforces completeness; *geography* — distance in metres without manual projection; *stored timezone* — AC 5 requires venue-local times; *social_links as JSON* — never filtered/joined on, validated by Pydantic.

**RSVP** — US-06/07
- `user FK`, `event FK`, `created_at`; `UniqueConstraint(user, event)` (no duplicate RSVP, AC 7)
- "Remove from my events" on a cancelled event = delete the row.
- Capacity race: RSVP inside `transaction.atomic()` with `select_for_update()` on the Event row.

**PaidMark** — US-08
- `user FK`, `event FK`, `created_at`; unique `(user, event)`
- Grounding: separate table because the tick must **survive cancelling attendance** (US-08), so it cannot live on the RSVP row.

**Notification** — US-22
- `recipient FK User`, `kind` (`event_cancelled|event_changed|admin_edited|admin_cancelled|organizer_approved|organizer_rejected`), `event FK null`, `payload JSON` (e.g. `{"changes":[{"field","old","new"}], "reason"}`), `is_read`, `created_at`; index `(recipient, is_read)`.
- Created via bulk_create in the same transaction as the change ⇒ atomic, no lost notifications.

**AuditLog** — US-17/18/21
- `actor FK User`, `action` (`event_edit|event_cancel|organizer_approve|organizer_reject`), `target_type`, `target_id`, `changes JSON`, `reason null`, `created_at`. Append-only.

Derived (not stored): `attendee_count` = `Count(rsvp)` annotation; `is_ongoing` = `start_at <= now < end_at`; `is_ended` = `end_at <= now`. Grounding: avoids counter drift.

---

## 3. API (Django Ninja, prefix `/api/v1`)

Auth legend: **P** public · **U** any logged-in non-admin · **O** organizer (owner) · **A** admin. All errors are JSON `{detail, field?}`; field-level errors map to the "red message under the field" ACs (422 with `field`).

- **Errors**: services raise typed errors from `common/errors.py` (`BusinessRuleError` 400, `AuthenticationFailedError` 401, `PermissionDeniedError` 403, `NotFoundError` 404, `ConflictError` 409, `FieldValidationError` 422). One handler in `config/api.py` maps them to `{detail, field}`; a second one reshapes Ninja's schema-validation 422 into the same shape. Grounding: one error shape for the SPA, whether a rule is declared on a schema or checked in a service.
- **Where rules live**: single-field format rules (title 3–100, URL, capacity > 0, currency `^[A-Z]{3}$`) are declared on the Ninja schema; cross-field and time-dependent rules (end > start, ticket link only with a price, start in future on publish, required-on-publish) are in `events.services.validate_*`. Grounding: schemas stay declarative, rules needing `now` or `action` stay testable without HTTP.
- **Router mounting**: `accounts` and `events` routers are mounted at the API root with full paths, `inbox` at `/inbox`, `moderation` at `/admin`. Grounding: `/me/*` endpoints belong to two apps.
- **Output schemas = Ninja `ModelSchema`** with `model_config = OUT_MODEL_CONFIG` (`common/schemas.py`); input forms stay plain `Schema`s. Values that are not model columns (`lat`/`lng`, `price`, `attendee_count`, `viewer`, …) are declared fields filled by selector annotations, model properties or `resolve_*` methods. Grounding: field names and types come from the models, so they cannot drift. `OUT_MODEL_CONFIG` corrects Ninja's input-oriented defaults: a `null=False` column is never null, `choices` become enums, and every response field is required. The forms differ from the tables (sport slug, `lat`/`lng` instead of a PointField, every field optional for drafts), so they can't be generated from the models.
- **Typed client**: `scripts/gen-api.{sh,ps1}` exports the OpenAPI schema (`manage.py export_openapi`) to `frontend/openapi.json`, and **openapi-typescript** (dev dependency) turns it into `frontend/src/api/schema.d.ts`; both files are committed. `npm run build` first runs `check:api`, which fails if `schema.d.ts` is out of date with `openapi.json`. Grounding: the frontend can't use a field or enum value that the API doesn't have, because `tsc` rejects it. It is a dev dependency only, with no runtime code in the bundle. Our own export command is needed because Ninja's `export_openapi_schema` requires `ninja` in `INSTALLED_APPS`, which §1 avoids. Limit: `check:api` only compares the committed files. After changing a backend schema or endpoint, run `scripts/gen-api` and commit both files.

### Health (unversioned)
| Method | Path | Auth | Stories |
|---|---|---|---|
| GET | `/api/health` | P | infra — `200 {status:"ok",database:"ok"}` or `503 {status:"error",database:"unavailable"}` |
- Grounding: lives outside `/api/v1` because the compose healthcheck depends on it, and an infrastructure probe must not move when the API version changes. It runs `SELECT 1`, so it proves nginx → backend → db end to end.

### Auth & account
| Method | Path | Auth | Stories |
|---|---|---|---|
| GET | `/auth/csrf` | P | sets CSRF cookie for the SPA |
| POST | `/auth/register` | P | registration |
| POST | `/auth/login` · `/auth/logout` | P / U | AC 7 redirect-to-login |
| GET | `/me` | logged in | role, unread count, organizer-request status (drives UI visibility) |
| POST | `/me/organizer-request` | U (attendee) | US-20 (409 if pending exists) |

### Reference data
| Method | Path | Auth | Stories |
|---|---|---|---|
| GET | `/sports` | P | filter dropdown, form |
| GET | `/cities/lookup?name=` | P | US-04 → `{name, lat, lng}` or 404 "City not found" |

### Discovery (map + list share one endpoint)
| Method | Path | Auth | Stories |
|---|---|---|---|
| GET | `/events` | P | US-01, 02, 03, 12, 23, 24 |
- Query: `lat`, `lng` (required), `radius_km` (default 10, max 50), `date_from`, `date_to` (ISO; client derives "today"/"this weekend" in venue tz), `sport` (slug, multi), `price=free|paid`, `max_price`, `q` (title icontains).
- Server always applies `status=published AND end_at > now()` and overlap `start_at < date_to AND end_at > date_from` (keeps ongoing events, US-01).
- Response: `{count, items:[{id,title,sport,start_at,end_at,timezone,venue_name,lat,lng,price,is_free,is_ongoing,distance_km}]}`, ordered ongoing-first then `start_at` (US-23).
- **Not paginated** (hard cap e.g. 1000). Grounding: AC 2 requires `count == markers == list entries`; map and list consume the same response, guaranteeing consistency.

### Event card
| Method | Path | Auth | Stories |
|---|---|---|---|
| GET | `/events/{id}` | P (drafts: owner only, else 404) | US-05, 11, 14 — full card incl. `attendee_count`, `capacity`, `status`, `cancelled`, plus viewer flags `{is_going, has_paid, can_edit, can_cancel, can_rsvp}` |
- Grounding for viewer flags: one place computes permissions so the SPA just hides/shows buttons (US-14/16/19); the same checks run again on write endpoints.

### Attending
| Method | Path | Auth | Stories |
|---|---|---|---|
| POST | `/events/{id}/rsvp` | U | US-06 (409 duplicate, 409 "Event is full", 400 if cancelled/ended, 401 → login) |
| DELETE | `/events/{id}/rsvp` | U | US-06 cancel attendance; US-07 "remove from my events" |
| PUT / DELETE | `/events/{id}/paid` | U | US-08 (PUT also creates RSVP via same service; DELETE leaves RSVP) |
| GET | `/me/events` | U | US-07 — RSVP'd, not ended, includes cancelled with tag, `has_paid` flag, ongoing-first sort |

### Organizing
| Method | Path | Auth | Stories |
|---|---|---|---|
| POST | `/events` | O (role organizer) | US-09/25 — body + `action: "draft" \| "publish"` |
| GET | `/me/drafts` | O | US-25 |
| PATCH | `/events/{id}` | O (owner) or A | US-16/17/25 — diff → Notification to RSVPs; admin ⇒ also organizer msg + AuditLog |
| POST | `/events/{id}/publish` | O owner | US-09/25 (draft → published; full validation) |
| DELETE | `/events/{id}` | O owner, **drafts only** | US-25 |
| POST | `/events/{id}/cancel` | O owner or A (`reason` required for A) | US-10/18 |
- Preview (US-15) needs **no endpoint**: SPA renders the card component from form state. Grounding: nothing is persisted or exposed before Publish.
- Validation: one Pydantic schema; "format" validators (URL, end>start, title length, capacity>0, start in future on publish) always run ⇒ block draft & publish; "required" check runs only on publish (matches the Saving rules table). Edit rejects capacity < current RSVPs and edits on cancelled/ended events.

### Inbox
| Method | Path | Auth | Stories |
|---|---|---|---|
| GET | `/inbox` | logged in | US-22 (paginated, newest first) |
| GET | `/inbox/unread-count` | logged in | badge |
| POST | `/inbox/{id}/read` | owner | marks read |

### Admin
| Method | Path | Auth | Stories |
|---|---|---|---|
| GET | `/admin/organizer-requests?status=pending` | A | US-21 |
| POST | `/admin/organizer-requests/{id}/approve` · `/reject` | A | US-21 → role change + Notification + AuditLog |
| GET | `/admin/audit-log` | A | US-17/18/21 traceability |
- US-19: RSVP/paid/my-events/create/organizer-request endpoints return 403 for role admin (enforced by permission helper, not only UI).

---

## 4. Cross-cutting rules
- Permission helpers (`require_role`, `require_owner_or_admin`) in one module; every write endpoint uses them ⇒ "direct requests are rejected" ACs.
- All times stored UTC; API returns ISO 8601 + event `timezone`; SPA formats with `Intl.DateTimeFormat(timeZone)`.
- Change-diff util compares old/new serialised event, used for both Notification payload and AuditLog.

## 5. Verification
- `docker compose up --build` → `http://localhost` serves SPA; `http://localhost/api/v1/docs` shows Ninja OpenAPI.
- `docker compose exec backend python manage.py test` — pytest/Django tests per story: radius/ongoing/ended filter, count consistency, duplicate RSVP & capacity race, draft vs publish validation, admin restrictions (403), notification + audit creation.
- API tests (`backend/test/test_api_*.py`) were written before the endpoints, as the contract (TDD), and now all pass. The capacity race is tested with two concurrent threads (`test_services_events.py`). Grounding: the interface was fixed and reviewable first, then every story's ACs were checked over real HTTP.
- Manual smoke: register → request organizer → approve as admin → create/publish → RSVP from second user → edit (inbox diff) → cancel (card shows Cancelled, gone from `/events`).
