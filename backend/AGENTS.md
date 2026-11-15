# backend/AGENTS.md – Django rules

Applies on top of the root [AGENTS.md](../AGENTS.md). Data model and endpoints: [docs/architecture.md](../docs/architecture.md) §2–3.

## Layout
- `config/`: settings (all values from env), `urls.py`, `api.py` (root `NinjaAPI` at `/api/v1`; mount each app's router here), `health.py` (unversioned `/api/health`), `logging_config.py`.
- `common/`: abstract `CreatedAtModel` / `TimeStampedModel`. Shared permission helpers and the diff util go here too.
- Domain apps: `accounts`, `events`, `inbox`, `moderation`. Create `selectors.py` / `services.py` / `schemas.py` / `views.py` only when a story needs them; no empty placeholder files.
- `test/`: every backend test, `test_<layer>_<app>.py` (e.g. `test_models_events.py`, later `test_services_events.py`).

## Model conventions
- Text fields: `blank=True`, empty value `""`, never `null=True`.
- Fields required only on publish are nullable/blank so drafts save (US-09/25); every `CheckConstraint` must let NULL through.
- Use `CheckConstraint(condition=...)` (`check=` is deprecated since Django 5.1).
- Name every constraint and index explicitly (index names ≤ 30 chars, Django check E034).
- Models hold only simple properties (`is_free`, `is_ongoing`, …). Business rules go in `services.py`.
- Choices are `TextChoices` nested in the model.

## Migrations
- Generate inside the container: `docker compose exec backend python manage.py makemigrations`, then commit the files.
- `python manage.py makemigrations --check --dry-run` must report no changes before a change is done.
- Reference data lives in `events/fixtures/` (`cities.json`, `sports.json`) and is loaded on every start; keep it idempotent (fixed pks).

## Tests
- Run: `docker compose exec backend python manage.py test`.
- The test DB is created by the Postgres superuser from `.env`; it needs PostGIS, so tests run against the `db` container, not SQLite.
