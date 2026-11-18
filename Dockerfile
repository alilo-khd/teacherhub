# TeacherHub — all-in-one image: React build served by Django (gunicorn),
# data in an external Postgres (Neon) via DATABASE_URL.
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build -- --base=/static/

FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 \
      libffi8 shared-mime-info fonts-noto-core fonts-noto-ui-core \
    && rm -rf /var/lib/apt/lists/*
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt
COPY backend/ ./
COPY --from=frontend /app/frontend/dist /app/frontend/dist
CMD ["sh", "-c", "python manage.py migrate --noinput && if [ \"${DJANGO_DEBUG:-1}\" = \"0\" ]; then python manage.py createcachetable teacherhub_cache --database default; fi && python manage.py seed_if_empty && python manage.py collectstatic --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --threads 2 --timeout 120"]
