# EventMap

A mobile-first web app for discovering local sports events on a map.

## Quick start
Requires Docker Desktop.

```bash
./scripts/start.sh          # Windows: powershell -ExecutionPolicy Bypass -File scripts\start.ps1
```

- App: http://localhost
- Health: http://localhost/api/health
- API docs: http://localhost/api/v1/docs
- Logs: `logs/eventapp_<YYYYMMDD-HHMMSS>.log` (one file per start)

Stop with `docker compose down`. Run the tests with `docker compose exec backend python manage.py test`.

See [AGENTS.md](AGENTS.md) and [docs/](docs/) for the architecture and working rules.
