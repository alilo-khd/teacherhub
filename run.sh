#!/usr/bin/env bash
# TeacherHub — local-only run helper. Always use an isolated SQLite sandbox.
set -euo pipefail
cd "$(dirname "$0")"

# Explicit environment values take precedence over any developer env files.
# Keep this helper off Neon/production; use a separate reviewed setup for any
# disposable Postgres sandbox.
export DATABASE_URL='sqlite:////tmp/teacherhub-development.sqlite3'
export DJANGO_DEBUG=1
export DJANGO_SECRET_KEY='dev-only-teacherhub-local-key-change-me'
export DJANGO_ALLOWED_HOSTS='localhost,127.0.0.1'

(cd backend && python3 manage.py runserver 127.0.0.1:8000 &)
(cd frontend && npm run dev -- --host 127.0.0.1 --port 5173 &)
wait
