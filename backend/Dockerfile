# Celestara API. Build from the backend/ directory:
#   docker build -t celestara-backend backend
FROM python:3.12-slim AS build

ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1

# pyswisseph publishes no prebuilt wheel for some platforms (notably Linux
# on ARM), so it compiles from source. The compiler lives in this stage only.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

# Dependencies first so this layer is reused when only application code
# changes. The stub package lets `pip install .` resolve them from
# pyproject.toml without the source being present yet.
WORKDIR /src
COPY pyproject.toml ./
RUN python -m venv /opt/venv \
    && mkdir app && touch app/__init__.py \
    && /opt/venv/bin/pip install . \
    && /opt/venv/bin/pip uninstall -y celestara-backend


FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

COPY --from=build /opt/venv /opt/venv

WORKDIR /app
COPY alembic.ini ./
COPY app ./app

# The default database is a SQLite file; keep it on a volume so it outlives
# the container. Set DATABASE_URL to use something else.
RUN useradd --create-home --uid 10001 celestara \
    && mkdir /data && chown celestara /data
USER celestara
ENV DATABASE_URL=sqlite:////data/celestara.db
VOLUME /data

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
