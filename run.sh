#!/usr/bin/env bash
# TeacherHub — run backend (:8000) and frontend (:5173) locally.
set -e
cd "$(dirname "$0")"
(cd backend && python3 manage.py runserver 127.0.0.1:8000 &)
(cd frontend && npm run dev -- --host 127.0.0.1 --port 5173 &)
wait
