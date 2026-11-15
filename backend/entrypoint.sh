#!/usr/bin/env sh
# Backend start sequence (docs/architecture.md "Compose services"):
# migrate -> load reference data -> gunicorn. Logs go to stdout/stderr only.
set -e

python manage.py migrate --noinput
python manage.py loaddata cities sports

exec gunicorn config.wsgi \
    --workers 3 \
    --bind 0.0.0.0:8000 \
    --access-logfile - \
    --error-logfile -
