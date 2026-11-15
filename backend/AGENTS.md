# backend/AGENTS.md – Django rules

Applies on top of the root [AGENTS.md](../AGENTS.md). Data model and endpoints: [docs/architecture.md](../docs/architecture.md) §2–3.

## Layout
- `config/`: settings (all values from env), `urls.py`, `api.py` (root `NinjaAPI` at `/api/v1`; mount each app's router here), `health.py` (unversioned `/api/health`), `logging_config.py`.
- `common/`: abstract `CreatedAtModel` / `TimeStampedModel`, `errors.py` (typed `DomainError`s → HTTP status), `permissions.py` (`require_*`), `diff.py` (`diff_fields`), `schemas.py` (`ErrorOut`, `OUT_MODEL_CONFIG`), `management/commands/export_openapi.py`.
- Domain apps: `accounts`, `events`, `inbox`, `moderation`, each with `selectors.py` / `services.py` / `schemas.py` / `views.py`. Every endpoint is implemented; the typed signatures and docstrings (Args/Returns/Raises) are the contract. Change them only together with architecture.md, and add a function only to avoid duplicated code (private `_helper`, keyword-only args like the public ones).
- Services/selectors raise `common.errors` types, never return HTTP responses; views never catch them (the handler in `config/api.py` does).
- `test/`: every backend test, `test_<layer>_<app>.py` (e.g. `test_models_events.py`, `test_api_events.py`); shared builders in `test/helpers.py`.

## Schemas
- Response schemas: `class XOut(ModelSchema)` with `model_config = OUT_MODEL_CONFIG` and `Meta.fields` listing model columns. Subclass `ModelSchema` **directly**: Ninja skips model-field generation for subclasses of a subclass.
- Non-column values are declared fields: filled by a selector annotation, a model property or a `resolve_*` static method (pure mapping, no queries). Don't also list a declared field in `Meta.fields` (Ninja deprecation warning).
- Input forms and non-model shapes (`PriceOut`, `ViewerFlagsOut`, query filters) stay plain `Schema`s.
- After changing any schema or endpoint, run `scripts/gen-api.sh` (Windows: `scripts\gen-api.ps1`) and commit `frontend/openapi.json` + `frontend/src/api/schema.d.ts`; the frontend build fails on stale types.

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
- `test_api_*.py` test each endpoint over HTTP against the user-story ACs; `test_services_events.py` holds the concurrent capacity-race test (`TransactionTestCase`). The whole suite must pass, with no exclusions.
- The test DB is created by the Postgres superuser from `.env`; it needs PostGIS, so tests run against the `db` container, not SQLite.
