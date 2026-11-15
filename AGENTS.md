# AGENTS.md – EventMap

EventMap is a mobile-first web app for discovering local sports events on a map. Visitors browse, search and filter; attendees RSVP; organizers publish events; admins moderate.

## Source-of-truth docs (read before changing behaviour)
- [docs/user_stories.md](docs/user_stories.md): US-01…US-25, acceptance criteria, form fields, decisions. **Behaviour.**
- [docs/architecture.md](docs/architecture.md): containers, data model, API endpoints and the reason for each. **Structure.**
- [docs/specification.md](docs/specification.md): original goals, roles and acceptance criteria.
- `backend/AGENTS.md`, `frontend/AGENTS.md`: side-specific rules. This file holds only what applies to the whole repo.

## Working rules
- Every decision needs a reason: cite a user story (`US-06`), an acceptance criterion or `architecture.md`. If a change departs from the docs, update the doc in the same change.
- Keep this file current and under 100 lines; move side-specific detail to that side's AGENTS.md.
- No new service, container or dependency without recording the reason in `architecture.md`.

## Stack
| Layer | Technology |
|---|---|
| Frontend | React + TypeScript (Vite) static build served by **nginx**; Leaflet + OpenStreetMap, client-side clustering |
| Backend | **Django + Django Ninja + GeoDjango**, gunicorn; REST API under `/api/v1` |
| Database | **PostgreSQL + PostGIS** (`postgis/postgis` image) |
| Runtime | **Docker Compose**: `frontend` (nginx), `backend`, `db` |

Browser → nginx: `/` → React files, `/api/*` → backend → db. Only nginx publishes a port; db sits on an internal network.

## Folder structure
```
eventapp/
  docker-compose.yml  .env.example  scripts/  logs/  docs/
  frontend/                  React app, Dockerfile, nginx.conf
  backend/
    config/                  settings, root NinjaAPI (mounts app routers), logging setup
    common/                  shared base classes, permission helpers, diff util
    accounts/ events/ inbox/ moderation/     domain apps
    test/                    all backend tests: test_<layer>_<app>.py
```
Every domain app uses the same layers:
| File | Responsibility |
|---|---|
| `models.py` | Tables, constraints, indexes. Only simple properties, no business logic. |
| `selectors.py` | Read-only queries (filters, annotations); return querysets/objects. |
| `services.py` | All writes and business rules, inside `transaction.atomic()`; keyword-only args. |
| `schemas.py` | Ninja (Pydantic) input validation and output shape only. |
| `views.py` | Thin Ninja `Router` endpoints: permission → schema → selector/service → response. |

Tests do not live in the apps: they all go in `backend/test/`, one file per layer and app, with test names that cite the user story (`test_us06_duplicate_rsvp_rejected`).

## Logging
- Every container logs to **stdout/stderr**; no container writes its own log file.
- `scripts/start.*` starts the stack and streams `docker compose logs -f --timestamps` into **one file per start**: `logs/eventapp_<YYYYMMDD-HHMMSS>.log`. Each line is prefixed with the service name.
- Python: `logging.getLogger(__name__)`, never `print`. `INFO` for business events (event published, RSVP), `WARNING` for rejected actions, `ERROR` with traceback for failures.
- Never log passwords, session IDs or personal data. `logs/` is git-ignored.

## Coding conventions
- **Type hints** on every function signature and public attribute.
- **Google-style docstrings**: one-line summary; `Args:` / `Returns:` / `Raises:` only when they add information.
- **Thin views**: no queries or business rules in views or schemas.
- **Principles & patterns**: follow SOLID, DRY and KISS. Use a design pattern (Singleton, Factory Method, Abstract Factory, Adapter, Composite, Proxy, Observer, Strategy, Memento, Template Method) only when it solves a concrete problem, and give the reason in the docstring.

## Commands
```bash
./scripts/start.sh        # build + start, log to logs/eventapp_<time>.log (Windows: scripts\start.ps1)
docker compose up --build # also works, but writes no log file
./scripts/gen-api.sh      # after any API change: regenerate frontend types from the backend (Windows: scripts\gen-api.ps1)
docker compose down       # stop
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate     # also runs automatically on backend start
docker compose exec backend python manage.py test
```
App: http://localhost · Health: http://localhost/api/health · API docs: http://localhost/api/v1/docs
