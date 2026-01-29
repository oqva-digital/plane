# OQVA Plane Fork — Documentation

---

## 4.1 Installation (README)

### Server prerequisites

- **Docker** (Docker Engine + Docker Compose v2)
- **Git**
- **~4GB RAM** (more for large teams)
- **Disk:** 10GB+ for images, plus space for PostgreSQL, Minio, and Redis data

### Step-by-step installation

#### Using `./run-oqva.sh` (recommended)

`run-oqva.sh` uses `docker-compose.yml` + `docker-compose.oqva.yml` and automates env setup, build, and service control. It also enables the Cloudflare Tunnel when `TUNNEL_TOKEN` is set in `.env`.

1. **Clone and enter the repo**

   ```bash
   git clone -b production https://github.com/oqva-digital/plane.git /opt/plane && cd /opt/plane
   ```

2. **Install (env + build)**

   ```bash
   chmod +x run-oqva.sh
   ./run-oqva.sh install
   ```

   - Creates root `.env` from `.env.example` or `deployments/cli/community/variables.env` if missing.
   - Creates `apps/{web,api,space,admin,live,breakdown}/.env` from each `.env.example` if missing.
   - Generates `SECRET_KEY` in `apps/api/.env` if empty.
   - Builds all images with the OQVA override (including `WEB_URL` → `VITE_*` for frontends).

3. **Edit `.env`**
   - Set at least: `POSTGRES_*`, `SECRET_KEY` (or leave generated), `LIVE_SERVER_SECRET_KEY`, `WEB_URL`, `CORS_ALLOWED_ORIGINS`, `RABBITMQ_*`, `AWS_*`.
   - Optional: `TUNNEL_TOKEN` for Cloudflare Tunnel — `./run-oqva.sh start` will enable the `tunnel` profile when set.
   - For AI task breakdown: `BREAKDOWN_API_URL` (e.g. `https://plane.example.com/breakdown/api`), `TASK_BREAKDOWN_API_KEY`, `PLANE_API_KEY`, and at least one of `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GOOGLE_API_KEY`.

4. **Start**

   ```bash
   ./run-oqva.sh start
   ```

   - Starts the stack. If `TUNNEL_TOKEN` is set, the `tunnel` service is also started.

5. **Other commands**
   | Command | Description |
   |---------|-------------|
   | `./run-oqva.sh stop` | Stops all services. |
   | `./run-oqva.sh upgrade` | `git pull`, rebuild, and `up -d`. |
   | `./run-oqva.sh logs [service]` | `docker compose logs` (optionally for one service). |
   | `./run-oqva.sh backup` | Full backup: `plane_db.dump.gz` (pg_dump), `uploads`, `rabbitmq_data`, `redisdata` → `backup/YYYYMMDD-HHMM/`. |
   | `./run-oqva.sh backup-db` | DB only: `plane_db.dump.gz` (pg_dump) → `backup/YYYYMMDD-HHMM/`. |

   **Backup and restore**
   - **Full backup** (`./run-oqva.sh backup` or `7`): `plane_db.dump.gz` (PostgreSQL via pg_dump), `uploads.tar.gz` (Minio), `rabbitmq_data.tar.gz`, `redisdata.tar.gz`. Requires `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD` in `.env`.
   - **DB only** (`./run-oqva.sh backup-db` or `8`): only `plane_db.dump.gz`. Useful for frequent DB-only backups or cron.
   - **Restore DB** from `plane_db.dump.gz`:
     ```bash
     # Recommended: stop the app first to avoid active DB connections.
     ./run-oqva.sh stop
     # Start only plane-db so we can restore: docker compose -f docker-compose.yml -f docker-compose.oqva.yml --env-file .env up -d plane-db
     # Wait a few seconds, then restore (source .env for POSTGRES_*):
     gunzip -c backup/YYYYMMDD-HHMM/plane_db.dump.gz | docker exec -i plane-db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl
     # Start again
     ./run-oqva.sh start
     ```
     To restore into an **empty** DB (e.g. new instance): `gunzip -c backup/.../plane_db.dump.gz | docker exec -i plane-db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl`
   - **Cron (e.g. daily DB backup at 3:00):**
     ```bash
     0 3 * * * cd /opt/plane && ./run-oqva.sh backup-db
     ```
     Or full backup: `0 3 * * * cd /opt/plane && ./run-oqva.sh backup`. Keep or rotate `backup/` (e.g. `find /opt/plane/backup -mtime +7 -delete`).

   Rebuild frontends after changing `WEB_URL`:

   ```bash
   ./run-oqva.sh upgrade
   # or: docker compose -f docker-compose.yml -f docker-compose.oqva.yml --env-file .env build --no-cache web admin space && ./run-oqva.sh start
   ```

---

#### Alternative: manual docker compose

If you are not using `run-oqva.sh` or `docker-compose.oqva.yml`:

1. **Clone and enter the repo**

   ```bash
   git clone -b production https://github.com/oqva-digital/plane.git /opt/plane && cd /opt/plane
   ```

2. **Root `.env`**
   - Copy from `deployments/cli/community/variables.env` or from `.env.example` if it exists:
     ```bash
     cp deployments/cli/community/variables.env .env
     ```
   - Edit `.env` and set at least:
     - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
     - `SECRET_KEY` (e.g. `openssl rand -hex 32`)
     - `LIVE_SERVER_SECRET_KEY` (required by `plane-live`)
     - `WEB_URL` (public URL, e.g. `https://plane.example.com`)
     - `CORS_ALLOWED_ORIGINS` (same as `WEB_URL` when in production)
     - `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `RABBITMQ_VHOST`
     - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME`

3. **App `.env` files**
   - Copy `.env.example` → `.env` for: `apps/web`, `apps/api`, `apps/space`, `apps/admin`, `apps/live`, `apps/breakdown`.
   - In `apps/api/.env`: ensure `SECRET_KEY` is set (generate if empty).

4. **Build and start**

   ```bash
   docker compose -f docker-compose.yml --env-file .env build
   docker compose -f docker-compose.yml --env-file .env up -d
   ```

5. **Wait for migrator and API**
   - The `plane-migrator` container runs Django migrations and exits.
   - The `api` service must be up and responding before the app is fully usable.
   - Access the app at `http://<host>:${LISTEN_HTTP_PORT}` or your public URL.

### Local development (pnpm dev + Docker backend)

Do development on the **develop** branch (see 4.3 Branch model). When you run the **frontend** with `pnpm dev` (web, admin, space on the host), the apps call the API at `http://localhost:8000`. The **backend and infra** run via `docker-compose-local.yml`; the frontend runs on the host for hot reload.

#### Step 1 — Root `.env`

Used by `plane-db`, `plane-mq`, `plane-minio`. From the project root:

```bash
cp deployments/cli/community/variables.env .env   # or .env.example if present
```

Edit `.env` and set at least:

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `RABBITMQ_VHOST`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME` (e.g. `uploads`) — Minio uses these.

You can also run `./setup.sh` to copy `.env` from `.env.example` for root and apps; you must still edit `apps/api/.env` as in Step 2 for Docker.

#### Step 2 — `apps/api/.env`

Used by the **API container**. The API talks to other services by **Docker service name**, not `localhost`.

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` and set:

| Variable                                     | Value for `docker-compose-local`                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `SECRET_KEY`                                 | `openssl rand -hex 32` or any secret                                                                                                       |
| `USE_MINIO`                                  | `1`                                                                                                                                        |
| `AWS_S3_ENDPOINT_URL`                        | `http://plane-minio:9000` — **do not** use `localhost`; from inside the container Minio is at `plane-minio`                                |
| `AWS_S3_BUCKET_NAME`                         | `uploads` (same as root `.env`)                                                                                                            |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Same as root `.env` (must match Minio)                                                                                                     |
| `REDIS_HOST`                                 | `plane-redis` (or `REDIS_URL=redis://plane-redis:6379/0`)                                                                                  |
| `POSTGRES_HOST`                              | `plane-db` (or `DATABASE_URL` with host `plane-db`)                                                                                        |
| `RABBITMQ_HOST`                              | `plane-mq`                                                                                                                                 |
| `CORS_ALLOWED_ORIGINS`                       | `http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3100` — or leave **empty** to allow all origins in dev |

#### Step 3 — Start backend and infra

From the **project root**:

```bash
docker compose -f docker-compose-local.yml up -d
```

This starts: **plane-db** (5432), **plane-redis** (6379), **plane-mq** (5672), **plane-minio** (9000, 9090), **api** (8000), **worker**, **beat-worker**, **migrator** (runs once and exits). Proxy and frontend are commented out; you run the frontend on the host.

#### Step 4 — Start the frontend

```bash
pnpm dev --filter=web --filter=admin --filter=space
```

Using `--filter` avoids running lib `:dev` tasks (`@plane/utils`, etc.) that can clear `dist` and break resolution. To include `live`: add `--filter=live`.

#### Step 5 — Access

- **Web:** http://localhost:3000
- **Admin (God Mode):** http://localhost:3001/god-mode/
- **Space:** http://localhost:3002

Register as instance admin at `/god-mode/` first, then sign in on the main app.

---

**Summary:** Root `.env` + `apps/api/.env` with **Docker hostnames** (`plane-minio`, `plane-redis`, `plane-db`, `plane-mq`) and `AWS_S3_ENDPOINT_URL=http://plane-minio:9000`; frontend `.env` with `VITE_API_BASE_URL=http://localhost:8000`; then `docker compose -f docker-compose-local.yml up -d` and `pnpm dev --filter=web --filter=admin --filter=space`.

### Required vs optional settings

| Variable                                        | Required           | Notes                                                         |
| ----------------------------------------------- | ------------------ | ------------------------------------------------------------- |
| `POSTGRES_*`, `DATABASE_URL` (or derived)       | Yes                | For `plane-db` and API.                                       |
| `SECRET_KEY` (in `apps/api/.env`)               | Yes                | Django.                                                       |
| `LIVE_SERVER_SECRET_KEY`                        | Yes                | `plane-live` refuses to start without it.                     |
| `WEB_URL`, `CORS_ALLOWED_ORIGINS`               | Yes for production | Must match the URL users access; needed for API and frontend. |
| `RABBITMQ_*`, `AMQP_URL`                        | Yes                | For workers.                                                  |
| `AWS_*`, `USE_MINIO`                            | Yes if using Minio | Object storage.                                               |
| `LISTEN_HTTP_PORT`, `LISTEN_HTTPS_PORT`         | No                 | Defaults 80, 443.                                             |
| `SITE_ADDRESS`, `CERT_EMAIL`, `TRUSTED_PROXIES` | No                 | For Caddy; defaults exist.                                    |
| `TUNNEL_TOKEN`                                  | No                 | Only if using Cloudflare Tunnel.                              |
| `ENABLE_DRF_SPECTACULAR`                        | No                 | Set to `1` to expose `/api/schema/`, Swagger, ReDoc.          |

### Troubleshooting

- **Proxy / Caddy: "unrecognized global option" or "wrong argument count" for `email`**  
  The root `Caddyfile.ce` uses `{$CERT_EMAIL}` as a standalone line; Caddy expects `email {$CERT_EMAIL}`. Use an override Caddyfile with `email {$CERT_EMAIL}` (and a default when empty, e.g. `email {$CERT_EMAIL:noreply@localhost}`) or ensure `CERT_EMAIL` is always set in the proxy env.

- **Frontend calls `http://localhost/api/...`**  
  `VITE_*` are fixed at **build** time. Set `WEB_URL` in the **root** `.env` to the public URL (e.g. `https://plane.example.com`), then **rebuild** `web`, `admin`, `space`:
  - With `run-oqva.sh`: `./run-oqva.sh upgrade` or build manually then `./run-oqva.sh start`.
  - Without:
    ```bash
    docker compose -f docker-compose.yml --env-file .env build --no-cache web admin space
    docker compose -f docker-compose.yml --env-file .env up -d
    ```

- **`plane-live` exits: `LIVE_SERVER_SECRET_KEY` required**  
  Set `LIVE_SERVER_SECRET_KEY` in the root `.env` and in the `live` service `environment` (or via an override). Restart `plane-live`.

- **Migrator fails**  
  Inspect logs: `docker compose logs migrator` or `./run-oqva.sh logs migrator`. Typical causes: wrong DB credentials, DB not ready. The API runs `wait_for_db`; the migrator uses `wait_for_db` then `migrate`. Fix DB or env and re-run.

- **502 / connection refused to API**  
  Ensure `api` is running and listening on 8000. Check `api` logs and `depends_on` (e.g. `plane-db`, `plane-redis`).

- **Local dev: "Could not connect to the endpoint URL: http://localhost:9000" or "Connection reset by peer" on /api/instances/**  
  The API runs inside Docker; `localhost` in `apps/api/.env` refers to the container, not the host. Set `AWS_S3_ENDPOINT_URL=http://plane-minio:9000` in `apps/api/.env` (and `USE_MINIO=1`). Restart: `docker compose -f docker-compose-local.yml up -d api`.

- **Local dev: CORS blocking requests from `http://localhost:3000`**  
  In `apps/api/.env` set `CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3100`, or leave it **empty** to allow all origins. Restart: `docker compose -f docker-compose-local.yml up -d api`.

- **Local dev: CSS or asset changes not reflecting (hot reload)**
  - **`globals.css`:** It is loaded via `?url` and `<link>`, so Vite HMR does not update it; use a **full refresh** (F5 or Cmd+R) after editing. Component-level CSS or Tailwind in TSX can still hot‑reload.
  - **File watching:** If the project is on a networked/synced drive (e.g. iCloud, NFS), enable polling: `CHOKIDAR_USEPOLLING=1 pnpm dev --filter=web --filter=admin --filter=space`.
  - **Service worker / PWA:** A registered service worker can serve stale assets. In DevTools → Application → Service Workers: unregister, or use "Update on reload", or test in an incognito window.
  - **Hard refresh:** Try Cmd+Shift+R (Mac) or Ctrl+Shift+R (Win/Linux).

- **`pnpm dev`: "Failed to resolve entry for package @plane/utils" or "Error loading ... react-router.config.ts"**  
  `@plane/utils` (and other libs) ship from `dist/`. Their `:dev` tasks (`tsdown --watch`) can clear `dist` at start and race with Vite. Avoid running those `:dev` tasks by filtering to the app(s) you need:

  ```bash
  pnpm dev --filter=web --filter=admin --filter=space
  ```

  Optional: add `--filter=live` if you develop `live`. Alternative: run `pnpm build` once, then `pnpm dev`; it may still race if lib `:dev` clears `dist`.

- **`pnpm dev`: "Cannot find module ... @plane/logger/dist/index.mjs" (live)**  
  Same cause as above: `@plane/logger:dev` (tsdown --watch) can clear `dist`. Use the filtered `dev` so lib `:dev` tasks do not run:
  ```bash
  pnpm dev --filter=web --filter=admin --filter=space --filter=live
  ```

### Validation checklist

- [ ] `docker compose ps` (or `./run-oqva.sh`-driven stack) shows `api`, `web`, `proxy`, `plane-db`, `plane-redis`, `plane-mq`, `plane-minio`, `plane-live`, `task-breakdown` (and `plane-migrator` as exited); if `TUNNEL_TOKEN` is set, `tunnel` is running.
- [ ] `curl -s -o /dev/null -w "%{http_code}" http://localhost:${LISTEN_HTTP_PORT}/` returns 200 (or 3xx to login).
- [ ] `curl -s -o /dev/null -w "%{http_code}" http://localhost:${LISTEN_HTTP_PORT}/api/instances/` returns 200 or 401 (not 5xx).
- [ ] In the browser, API requests in the Network tab use the **public** `WEB_URL` (or `/api/...` on the same origin), not `http://localhost:8000` when you use a different domain.

---

## 4.2 Endpoints

### Public URL

- **App (main):** `https://plane.mush.so` or `http://<host>:${LISTEN_HTTP_PORT}/`
- **Spaces:** `https://plane.mush.so/spaces/`
- **God Mode (admin):** `https://plane.mush.so/god-mode/`
- **Live (collab):** `https://plane.mush.so/live/`

The proxy (Caddy) maps these paths to the right service; no extra public ports are needed for `web`, `space`, `admin`, or `live`.

### Internal ports (proxy → services)

| Path / target                    | Service        | Port |
| -------------------------------- | -------------- | ---- |
| `/`                              | web            | 3000 |
| `/spaces/*`                      | space          | 3000 |
| `/god-mode/*`                    | admin          | 3000 |
| `/live/*`                        | live           | 3000 |
| `/breakdown/*`                   | task-breakdown | 3003 |
| `/api/*`, `/auth/*`, `/static/*` | api            | 8000 |
| `/{BUCKET_NAME}/*`               | plane-minio    | 9000 |

Other services are not exposed by the proxy: `plane-db` (5432), `plane-redis` (6379), `plane-mq` (5672, 15672 for management), `plane-minio` console (9090). Use `docker compose exec` or internal DNS if you need them.

### REST API

- **Base path:** `/api/` and `/api/v1/` (and `/auth/` for auth).
- **Main app API:** `plane/urls.py` → `api/` → `plane.app.urls` (workspaces, projects, issues, cycles, modules, etc.).
- **Public / Space API:** `api/public/` → `plane.space.urls`.
- **Instances / license:** `api/instances/` → `plane.license.urls`.
- **API v1:** `api/v1/` → `plane.api.urls` (cycles, issues, modules, projects, etc.).
- **Auth:** `auth/` → `plane.authentication.urls` (sign-in, sign-up, OAuth, magic link, etc.).

OpenAPI (if `ENABLE_DRF_SPECTACULAR=1`):

- Schema: `/api/schema/`
- Swagger: `/api/schema/swagger-ui/`
- ReDoc: `/api/schema/redoc/`

### Health checks

- **API (Django):**
  - Root: `GET /` often returns 200 or a redirect; `GET /api/instances/` is a simple API check.
  - There is no dedicated `/health` in the default `plane/urls.py`; you can rely on `GET /` or `/api/instances/` (expect 200/401, not 5xx) or add a custom health view.
- **Web / Admin / Space:**
  - Served by nginx or `react-router-serve`; `GET /` with 200 is a practical health check.
- **Proxy (Caddy):**
  - Caddy does not expose a built-in health URL; `GET /` with 200 is typical.

### God Mode (admin panel)

- **URL:** `https://plane.mush.so/god-mode/` (redirects to `/god-mode/`).
- **Role:** Instance admin: users, workspaces, authentication, OAuth, SMTP, etc.
- **Access:** Only for users with instance-admin permissions.

---

## 4.3 Updates

### Branch model

| Branch         | Role                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **master**     | Copy of the forked upstream (makeplane/plane). Kept in sync with upstream via merge; minimal or no OQVA-specific commits so upstream merges stay clean. |
| **develop**    | Development branch. Do feature work, OQVA customizations, and day-to-day development here.                                                              |
| **production** | Branch that is **deployed and runs** in production. Clone with `-b production`; `run-oqva.sh` and deploys use this branch.                              |

Typical flow: merge upstream into **master**; merge **master** into **develop**; when ready to release, merge **develop** into **production** and deploy.

### Syncing the fork with upstream

**Frequency:** sync with upstream **on each release** (e.g. when makeplane/plane publishes a new tag or release). Avoid long drift to reduce merge conflicts.

Merge upstream into **master** (from the branch model above):

```bash
git checkout master
git remote add upstream https://github.com/makeplane/plane.git   # if not already
git fetch upstream
git merge upstream/preview
# resolve conflicts, then:
```

- **With `run-oqva.sh`:**  
  `./run-oqva.sh upgrade`  
  (`upgrade` does `git pull`, rebuild, and `up -d`; run `git merge` / `git pull` first if you use a separate upstream-merge workflow.)
- **Without:**
  ```bash
  docker compose -f docker-compose.yml --env-file .env build --no-cache
  docker compose -f docker-compose.yml --env-file .env up -d
  ```

Rebase is an alternative to merge; in all cases merge upstream into `master` first, then `master` into `develop`, so history stays manageable.

### Testing updates in staging

1. Use a separate clone or branch and `.env` (e.g. other `POSTGRES_*`, `LISTEN_HTTP_PORT`).
2. `git pull` / merge from upstream, then:
   - **With `run-oqva.sh`:** `./run-oqva.sh upgrade` (handles build and `up -d`).
   - **Without:** `docker compose build --no-cache` and `up -d`.
3. The migrator runs on `up -d` via the `migrator` service.
4. Smoke-test: login, create workspace/project, create issue, check Spaces and God Mode.

### Rollback

1. **Code:**  
   `git revert` or `git reset --hard` to the previous known-good commit, then:
   - **With `run-oqva.sh`:** `./run-oqva.sh upgrade` (or `./run-oqva.sh stop` then rebuild and `./run-oqva.sh start`).
   - **Without:**
     ```bash
     docker compose -f docker-compose.yml --env-file .env build --no-cache
     docker compose -f docker-compose.yml --env-file .env up -d
     ```

2. **Database:**  
   Migrations are one-way; there is no automatic down-migration. Rollback options:
   - Restore a **DB backup** from before the update (e.g. `pgdata` volume or `pg_dump`), then bring the old images up against that volume.
   - Or fix forward: keep the new code and add a new migration to correct data/schema.

3. **Volumes:**  
   If you must fully reset (loss of data):
   - **With `run-oqva.sh`:** `./run-oqva.sh stop` then `docker compose -f docker-compose.yml -f docker-compose.oqva.yml --env-file .env down -v` (or equivalent). Restore from backup or start clean; on next `./run-oqva.sh start`, the migrator runs again.
   - **Without:**
     ```bash
     docker compose -f docker-compose.yml --env-file .env down -v
     docker compose -f docker-compose.yml --env-file .env up -d
     ```

### Database migrations (Django) and the migrator container

- **Who runs migrations:**  
  The `migrator` service: `./bin/docker-entrypoint-migrator.sh` → `wait_for_db` then `python manage.py migrate`.

- **When:**  
  On each `docker compose up -d`, the one-off `migrator` runs before long-lived services depend on a migrated DB. The API/worker/beat images also call `wait_for_db` but do **not** run `migrate`; only the migrator does.

- **Cautions:**
  - Back up the `pgdata` volume (or `pg_dump`) before updating when the upstream has new migrations.
  - If the migrator fails, the API may fail or misbehave; check `docker compose logs migrator` or `./run-oqva.sh logs migrator` after an upgrade.
  - Do not run `migrate` manually in the `api` container as a normal process; the migrator is the single place for schema updates.

---

## 4.4 Customization

### UI / themes (Next.js-style + Vite, React, Tailwind)

- **Main app (web):**
  - **Styles:** `apps/web/styles/globals.css` (globals, `:root`, `[data-theme]` for light/dark).
  - **Components:** `apps/web/app/` (routes and pages), `apps/web/ce/` (community) and `apps/web/ee/` (enterprise), `apps/web/core/`.
  - **Tailwind:** `apps/web` uses `@plane/tailwind-config` and `postcss.config.js`; theme-related tokens live in `packages/utils` (e.g. `packages/utils/src/theme/`).

- **Admin:** `apps/admin/` — `app/`, `ce/`, `ee/`, `core/`, `styles/`.

- **Space:** `apps/space/` — same idea: `app/`, `ce/`, `ee/`, `core/`, `styles/`.

- **Theme / design tokens:**  
  `packages/utils/src/theme/` (e.g. `theme-inversion.ts`, `constants.ts`, `theme-application.ts`). Prefer changing tokens and `globals.css` over one-off component styles to keep consistency.

- **Tailwind:**  
  Shared config in `packages`; each app’s `tailwind.config.*` may extend it. Use `@apply` or utility classes; avoid hardcoding colors in new UI so themes keep working.

### Backend (Django)

- **App structure:** `apps/api/plane/`
  - `app/` — workspaces, projects, issues, cycles, views, etc. (`urls/`, `views/`).
  - `api/` — API v1 serializers, views, URLs.
  - `authentication/` — sign-in/up, OAuth, magic link.
  - `license/` — instance and license.
  - `space/` — Space-specific API.
  - `bgtasks/` — Celery tasks.
  - `db/` — models, migrations.
  - `settings/` — Django settings.

- **Where to change logic:**
  - New or changed **APIs:** add views in the right `app` or `api` module and register in the corresponding `urls/`.
  - **Business logic:** in `app/` or `api/` views, services, or `bgtasks/`; avoid putting it in models.
  - **Models:** `db/models/`; any change needs a Django migration.

- **Migrations:**  
  Create with `python manage.py makemigrations` (run in `api` image or local env with the same `DATABASE_URL`). Commit the new files under `plane/db/migrations/` or the app’s `migrations/`.

### Adding new features

1. **Backend:** models (if needed) + migration, views/serializers, URL wiring, and tests in `apps/api/plane/tests/`.
2. **Frontend:** new components in `ce/` (or `ee/` if you mirror the split), hooks, and routes in `app/`. Call the new API from the app that needs it (web/admin/space).
3. **Config:** new env vars in `plane/settings/` and in `.env` / `variables.env` (and in your run-oqva or override, if used).
4. **Proxy:** if you add a new path or service, update the Caddyfile (or `Caddyfile.oqva.ce`).

### Building custom images

All app images are built from the repo (no prebuilt registry needed).

- **With `run-oqva.sh`:**
  - `./run-oqva.sh install` — builds all images (and sets up env if needed).
  - `./run-oqva.sh upgrade` — `git pull`, rebuild, and `up -d`.
  - To only rebuild (no `git pull`):  
    `docker compose -f docker-compose.yml -f docker-compose.oqva.yml --env-file .env build --no-cache` then `./run-oqva.sh start`.
- **Without override:**
  ```bash
  docker compose -f docker-compose.yml --env-file .env build
  # or, to force a clean rebuild:
  docker compose -f docker-compose.yml --env-file .env build --no-cache web admin space api
  ```

Ensure `WEB_URL` (and, if using the OQVA override, `VITE_*`) are set in `.env` before building web/admin/space so the frontend points to the correct API and origin.

### Practices to avoid breaking future merges

- **Prefer `ce/` over `core/` or `ee/` for custom UI** so you have a clear boundary; avoid editing `core/` or `ee/` unless necessary.
- **Backend:** add new modules or endpoints instead of patching core app code where possible; use `plane.db`, `plane.app`, `plane.api` as namespaces.
- **Env and compose:** keep customizations in **override** files (`docker-compose.oqva.yml`, `Caddyfile.oqva.ce`, `env.oqva.example`) and scripts (`run-oqva.sh`) so `docker-compose.yml`, `Caddyfile.ce`, and `variables.env` stay merge-friendly.
- **Migrations:** never edit existing migration files; only add new ones. After merging upstream, run `makemigrations` and `migrate` in a staging environment first.
- **i18n:** if you add user-facing strings, add keys under `packages/i18n` (or the app’s locale files) so upstream i18n merges do not conflict heavily.

---

## 4.5 Commit conventions

Use **Conventional Commits** (https://www.conventionalcommits.org/):

```
<type>[(<scope>)]: <description>

[optional body]

[optional footer]
```

- **Types:** `feat` (feature), `fix` (bug fix), `docs`, `chore`, `refactor`, `style`, `test`, `perf`, `ci`, `build`.
- **Scope (optional):** e.g. `web`, `api`, `run-oqva`, `proxy`.
- **Description:** imperative, lowercase start; no period at the end.
- **Body / footer:** when useful (e.g. `BREAKING CHANGE:`, `Refs #123`).

**Examples:**

```
feat(web): add maintenance banner in top nav
fix(api): strip quotes from getEnvValue for POSTGRES_USER
docs(oqva): document backup restore and clean restore
chore(run-oqva): add backup-db to menu
refactor(admin): inline basePath in vite.config to avoid @plane/utils at load
```
