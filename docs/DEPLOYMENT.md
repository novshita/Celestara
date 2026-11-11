# Deploying Celestara

Everything below was run against the real Docker images, including the
backup and restore.

## 1. Start it on PostgreSQL

SQLite (the default) is fine for trying the app. For anything real, use
PostgreSQL:

```bash
cat > .env <<'ENV'
POSTGRES_PASSWORD=<a long random password>
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-5-5
ENV
docker compose -f docker-compose.yml -f docker-compose.postgres.yml up --build -d
```

The schema is created on first start (Alembic runs automatically). Check it:
`curl localhost:8000/health` returns `{"status":"ok", ...}`.

## 2. Before real users arrive

| Check | Why |
|---|---|
| Serve the site over **HTTPS** | The login cookie is `Secure` in production, so over plain `http://` (other than `localhost`) browsers drop it and nobody can stay signed in. |
| **Do not expose port 8000.** Only the frontend (3000) should be reachable | The browser never talks to the backend directly. Delete the backend `ports:` entry, or firewall it. |
| Put a reverse proxy in front (Caddy, nginx, a cloud load balancer) and let it terminate TLS | Free certificates with Caddy need no configuration beyond the domain name. |
| Behind exactly one proxy that sets `X-Forwarded-For`: set `FORWARD_CLIENT_IP=true` (frontend) **and** `RATE_LIMIT_TRUST_FORWARDED_FOR=true` (backend) | Otherwise every visitor shares one AI rate limit. With no such proxy, leave both off: the header is client-controlled. |
| Set `ANTHROPIC_MODEL` deliberately | Opus is the default and the most expensive. Sonnet or Haiku are cheaper; choose on cost and answer quality. |
| `AI_RATE_LIMIT_PER_MINUTE` (default 10 per client) | This is your cost guard. Lower it if the key is shared widely. Set a spend limit in the Anthropic console too. |
| If you ever run more than one backend worker: `AUTO_MIGRATE=false`, and run `alembic upgrade head` once before starting them | Two workers migrating at once race. |
| Metrics: `METRICS_ENABLED=true` and a `METRICS_TOKEN` | `/metrics` holds only counts and timings, but keep it off the public internet. |
| Review the security headers (`frontend/next.config.ts`) | They block framing and sniffing. There is no strict Content-Security-Policy yet (Next.js needs per-request nonces for that), so treat it as a future hardening step. |

Not provided, and not a code matter: a privacy policy and terms page, and an
astrology review of the content (see "Open items" in the README).

## 3. Backups

The database holds personal data (birth details, journal entries, saved
questions). Treat every backup as personal data: keep it encrypted and
access-controlled. A user's "Delete my data" removes them from the live
database only; a backup taken earlier still contains them until it expires, so
choose a retention period (30 days is common) and say so in your privacy
policy.

**PostgreSQL** (the compose override):

```bash
mkdir -p backups
docker compose -f docker-compose.yml -f docker-compose.postgres.yml exec -T db \
  pg_dump -U celestara -Fc celestara > backups/celestara-$(date +%F).dump
```

Run that nightly (cron or your host's scheduler) and copy the file off the
machine. A backup you have never restored is a hope, not a backup, so test the
restore:

```bash
D="docker compose -f docker-compose.yml -f docker-compose.postgres.yml"
$D exec -T db psql -U celestara -d postgres -c "create database restore_check;"
$D exec -T db pg_restore -U celestara -d restore_check --no-owner \
  < backups/celestara-2026-11-11.dump
$D exec -T db psql -U celestara -d restore_check -c "select count(*) from users;"
$D exec -T db psql -U celestara -d postgres -c "drop database restore_check;"
```

**Restoring for real** (data loss or a bad deploy): stop the backend, restore
into an empty database, start the backend.

```bash
$D stop backend frontend
$D exec -T db psql -U celestara -d postgres -c "drop database celestara;" -c "create database celestara;"
$D exec -T db pg_restore -U celestara -d celestara --no-owner < backups/<file>.dump
$D start backend frontend
```

**SQLite** (the default compose file): the database is one file on the
`celestara-data` volume.

```bash
docker run --rm -v celestara_celestara-data:/data -v "$PWD/backups:/out" alpine \
  cp /data/celestara.db /out/celestara-$(date +%F).db
```

(Check the volume name with `docker volume ls`; it is prefixed with the
project folder name.) Copying while the app is writing can catch a half-written
page, so stop the backend first if you need an exact copy.

## 4. Updating and rolling back

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.postgres.yml up --build -d
```

New migrations apply on start. **Take a backup first**; migrations only go
forward in this setup. To roll back, check out the previous version and restore
the backup taken before the update. The API fingerprints every calculation with
a version (`calculation_version` in `/health`), so you can tell which build is
running.

## 5. Day-to-day

- Logs: `docker compose logs -f backend` (every request has a request id).
- Health: `GET /health` on the backend; the image's health check uses it.
- A failing AI path shows users "The AI guide isn't answering right now"; the
  rest of the app keeps working. Look at `celestara_ai_*` metrics and the
  backend log.
- Dependabot opens update pull requests weekly; the Security workflow fails a
  PR that introduces a fixable high/critical vulnerability.
