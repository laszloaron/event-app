# EventMap

A web app for discovering local sports events on a map. Visitors browse, search and filter; attendees RSVP; organizers publish events; admins moderate.

## Setup

### Requirements
- **Docker Desktop** (Windows/macOS) or Docker Engine + Compose v2 (Linux), running.
- Port **80** free on the host (only nginx publishes a port).
- Internet access on the first start (Docker images, Python and npm packages, map tiles from OpenStreetMap).

No local Python or Node.js is needed: everything is built inside the containers.

### 1. Start the app
From the `eventapp` folder:

```bash
./scripts/start.sh                                         # Linux / macOS / Git Bash
powershell -ExecutionPolicy Bypass -File scripts\start.ps1 # Windows PowerShell
```

The script:
1. creates `.env` from `.env.example` if it doesn't exist (development defaults; change the password and secret key for any shared deployment);
2. builds and starts the three containers: `db` (PostgreSQL + PostGIS), `backend` (Django), `frontend` (nginx + React);
3. on backend start, applies the database migrations and loads the seed data (cities and sports) automatically;
4. writes all container logs into `logs/eventapp_<YYYYMMDD-HHMMSS>.log`.

The first build takes a few minutes. `docker compose up --build` also works, but writes no log file.

### 2. Open it
- App: http://localhost
- Health check: http://localhost/api/health (should answer `{"status": "ok", "database": "ok"}`)
- API docs: http://localhost/api/v1/docs

The browser asks for your location; if you deny it, type a city (e.g. `Budapest`, `Debrecen`, `Szeged`).

### 3. Create users
- **Attendee:** register in the app (Log in → Create one).
- **Admin:** there is no sign-up for admins (US-19); create one from the command line:
  ```bash
  docker compose exec backend python manage.py shell -c "from accounts.models import User; u = User.objects.create_user('admin', 'admin@example.com', 'Admin-pass-123'); u.role = 'admin'; u.save()"
  ```
- **Organizer:** log in as an attendee → Account → "Become an organizer", then log in as the admin → Moderation → Approve (US-20/21).

### 4. Stop, restart, reset
```bash
docker compose down        # stop; the data stays in the `pgdata` volume
./scripts/start.sh         # start again with the same data
docker compose down -v     # stop AND delete all data (users, events)
```

### Tests
```bash
docker compose exec backend python manage.py test
```

### Frontend development (optional)
Requires Node.js 20. The Vite dev server proxies `/api` to `localhost:8000`, so the backend must be reachable there (e.g. a `docker-compose.override.yml` that publishes the backend port).
```bash
cd frontend
npm install && npm run dev   # http://localhost:5173
```
After changing a backend schema or endpoint, regenerate the frontend API types with `./scripts/gen-api.sh` (Windows: `scripts\gen-api.ps1`).

## Documentation
- [docs/user_stories.md](docs/user_stories.md): user stories US-01…US-25 with acceptance criteria.
- [docs/architecture.md](docs/architecture.md): containers, data model, API, and the reason for each decision.
- [docs/ui_design.md](docs/ui_design.md): design tokens, components, screens and URL routing.
- [AGENTS.md](AGENTS.md): working rules and conventions.
