FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv
COPY pyproject.toml alembic.ini ./
COPY app ./app
COPY alembic ./alembic
RUN uv sync --frozen --no-dev
VOLUME ["/data"]
ENV DATABASE_URL=sqlite:////data/app.db
EXPOSE 8000
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000"]
