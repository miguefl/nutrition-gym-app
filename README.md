# Weekly Menu — recipes, validator, plan & adherence

> 🇬🇧 English version. · 🇪🇸 [Versión en español](README.es.md)

Web app to manage meals and keep them aligned with a nutrition plan based on
the **block method** (método de los bloques). It lets you browse recipes,
validate them against the target pattern per meal type, auto-adjust quantities,
plan the week, generate a shopping list, track adherence and ask an AI for block
equivalences and full recipes.

> **Note on language:** the code (identifiers, functions, file names, API
> routes) is in English. The **persisted data** (JSON keys and enum values such
> as `nombre`, `tipo_comida`, `desayuno`, `carbohidratos`) and the **UI text**
> remain in Spanish on purpose — they model a Spanish nutrition domain and are
> left untouched.

## Quick start

```bash
npm install
npm start            # http://127.0.0.1:3000
# AI features need an Anthropic key:
export ANTHROPIC_API_KEY=sk-ant-...
```

First run seeds the login with **user `test` / password `test`** (change it from
the **Cuenta** button). Without `ANTHROPIC_API_KEY` everything works except the
AI tabs, which return a clear error.

## Architecture

No build step. Node.js + Express backend with file-based JSON storage; vanilla
HTML/CSS/JS frontend served statically; Anthropic SDK for the AI features.

The backend is layered (controller → service → repository), similar in spirit
to a Spring app:

```
app/
├── server.js                     # Entry point (only starts the app)
├── src/
│   ├── app.js                    # Express app factory (middleware + routes)
│   ├── config.js                 # Centralized config (env, paths, limits)
│   ├── errors.js                 # Domain errors with HTTP status
│   ├── validation.js             # Whitelist validation/sanitization of input
│   ├── middleware/
│   │   ├── security.js           # Helmet+CSP, Origin check, rate limiters
│   │   ├── auth.js               # Cookie parsing + requireAuth guard
│   │   └── errorHandler.js       # Error responses without internal leaks
│   ├── routes/                   # HTTP endpoints
│   ├── services/                 # Business logic (recipes, aliases, AI, auth…)
│   └── repositories/             # JSON data access (atomic + per-file lock)
├── datos/                        # Data (file names kept in Spanish)
│   ├── recetas.json              # Recipes
│   ├── equivalencias.json        # Categories, per-block equivalences, rules
│   ├── alias.json                # User-approved equivalences (AI)
│   ├── plan.json                 # Weekly plan (day → meal → recipe)
│   ├── registro.json             # Adherence (date → meal → ok/fallo)
│   ├── auth.json                 # Credentials (hash + session secret) — gitignored
│   └── .versions/                # Previous copies of each file (last 10)
└── public/
    ├── index.html                # Layout + 7 tabs + login
    ├── manifest.webmanifest      # Installable PWA
    ├── sw.js                     # Service worker (offline, network-first)
    ├── icons/                    # PWA icons 192/512
    ├── css/styles.css
    └── js/
        ├── utils.js              # escapeHtml, toast, cap (shared)
        ├── auth-view.js          # Login gate, logout, change credentials
        ├── blocks.js             # Engine: aliases, blocks, validation, adjust
        ├── data.js               # HTTP client with in-memory cache
        ├── recipes-view.js       # Listing + filters + edit/delete
        ├── validator-view.js     # Form + validation + save/update
        ├── adjust-view.js        # Computes quantities + AI recipe suggestion
        ├── equivalences-view.js  # Alias listing + AI query + delete
        ├── plan-view.js          # Weekly planner
        ├── shopping-view.js      # Aggregated shopping list
        ├── log-view.js           # Weekly adherence log
        └── app.js                # Bootstrap + tabs + service worker
```

## Authentication

Single-user login (no separate spaces; it just gates access to the app).

- Initial credentials: **user `test`, password `test`**. Change them from the
  **Cuenta** button in the header.
- The password is stored **hashed with scrypt** (per-user salt) in
  `datos/auth.json`, together with a random session secret. That file is **not
  included in the Docker image or in git** and is created on first run.
- The session is a token signed with HMAC-SHA256 in an `HttpOnly; SameSite=Strict`
  cookie. Changing credentials rotates the secret and **invalidates previous
  sessions**.
- Login is rate limited (10 attempts / 15 min).

If you forget the password, delete `datos/auth.json` and restart: it is
regenerated as `test`/`test`.

## Features

1. **Recipes** — grid with filters by meal type, ingredient and macros; edit and delete.
2. **Plan** — 7 days × 4 meals; assign a recipe to each slot.
3. **Shopping** — aggregates the ingredients of planned recipes, sums quantities, groups by category; check off what you have (kept on the device).
4. **Adherence log** — navigable week with ✓/✗ per planned meal and weekly adherence %.
5. **Validator** — checks a recipe against the meal-type block pattern, lists issues, auto-fixes quantities and saves/updates.
6. **Adjust** — list ingredients and get fitting quantities, or ask the AI for a full recipe.
7. **Equivalences (AI)** — query Claude for a food's block equivalence, review and approve it; delete approved ones.
8. **Backup / PWA** — *Exportar datos* downloads everything as JSON; each write keeps the previous version under `datos/.versions/`. Installable PWA, usable offline with the last seen data.

## REST API

All endpoints return JSON; errors respond with `{"error": "message"}`. Except
the `/api/auth` routes, **every endpoint requires a session** (cookie
`menu_sid`); without it they answer `401`. JSON payload keys stay in Spanish.

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/auth/me` | Session status `{ authenticated, username }`. Never 401. |
| `POST` | `/api/auth/login` | Log in `{ username, password }`. Sets the session cookie. 401 on failure. Rate limit 10/15 min. |
| `POST` | `/api/auth/logout` | Log out (clears the cookie). |
| `POST` | `/api/auth/change` | Change username and/or password `{ currentPassword, newUsername?, newPassword? }`. Rotates the secret. |
| `GET` | `/api/recipes` | All recipes. |
| `POST` | `/api/recipes` | Create a recipe. 400 invalid; 409 duplicate name. |
| `PUT` | `/api/recipes/:name` | Update (and rename) a recipe. 404 / 409. |
| `DELETE` | `/api/recipes/:name` | Delete a recipe. 204 / 404. |
| `GET` | `/api/equivalences` | Raw `datos/equivalencias.json`. |
| `GET` | `/api/aliases` | Approved aliases. |
| `POST` | `/api/aliases` | Upsert an alias by normalized name. |
| `DELETE` | `/api/aliases/:name` | Delete an approved alias. 204 / 404. |
| `GET` | `/api/plan` | Weekly plan. |
| `PUT` | `/api/plan` | Replace the full plan. 400 if it references missing recipes. |
| `GET` | `/api/log` | Adherence log `{ "YYYY-MM-DD": { desayuno: "ok"|"fallo" } }`. |
| `PUT` | `/api/log/:date` | Mark a meal `{ comida, estado: "ok"|"fallo"|null }`. |
| `GET` | `/api/backup` | Download all data as a single JSON. |
| `POST` | `/api/ai/equivalence` | Ask Claude for a food's block equivalence `{ nombre, contexto? }` → `{ alias }`. 503 if no key. Rate limit 20/h. |
| `POST` | `/api/ai/recipe` | Ask Claude for a full recipe `{ tipo_comida, ingredientes: [...] }` → `{ receta, justificacion }`. |

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | AI only | Anthropic API key. Read automatically by the SDK. |
| `PORT` | No | HTTP port (default 3000). |
| `HOST` | No | Listen interface (default `127.0.0.1`; the container uses `0.0.0.0`). |
| `COOKIE_SECURE` | No | `true` to mark the session cookie as `Secure` (use behind HTTPS). |

## Storage

Data is stored as JSON files under `datos/` (atomic writes, per-file lock,
versioned backups) — enough and robust for a single user. If the app ever grows
(multiple users, server-side queries, a large adherence log), the natural next
step is **SQLite**; the plan lives in [docs/sqlite-migration.md](docs/sqlite-migration.md)
and is tracked on the `feature/sqlite-migration` branch. Because data access is
isolated in the repository layer, only `src/repositories/*` would change.

## Testing

Three layers, no real data is touched (tests run against a temp `DATA_DIR`):

```bash
npm test               # unit + integration
npm run test:unit         # node:test — validation, blocks engine, auth service
npm run test:integration  # supertest — full API with sessions
npx playwright install --with-deps chromium   # one-time: install the browser + system libs (needs root / CI)
npm run test:e2e          # Playwright — browser flows (login, recipes, plan)
```

- **Unit** (`tests/unit/`): `validation.js`, the block engine (`public/js/blocks.js`, loaded into a Node VM) and `authService` (scrypt hashing, token rotation).
- **Integration** (`tests/integration/`): the Express app via `supertest` — auth gate, recipes CRUD, aliases, plan, log, backup, the AI 503 path, CSP header and the cross-origin 403.
- **E2E** (`tests/e2e/`): Playwright drives a real browser against a throwaway server (`tests/e2e/start-server.js`). The browser needs system libraries; on a fresh machine run `npx playwright install --with-deps chromium` first (requires root / CI). Config in `playwright.config.js`.

Tests set `NODE_ENV=test` (rate limits relaxed) and never use a real Anthropic key.

## Security notes

API key only on the server; input validated/sanitized with a whitelist; output
HTML-escaped (XSS); Helmet + strict CSP; same-origin check on mutations; rate
limits on writes, AI and login; atomic writes with per-file locks; generic 500s
without leaking internals. The app listens on localhost by default. To expose it
on your LAN, publish the port and add HTTPS (`COOKIE_SECURE=true`).

## Docker

```bash
cp .env.example .env        # set ANTHROPIC_API_KEY / APP_PORT if you want
docker compose up -d --build
```

By default the port is published on **all interfaces** (`0.0.0.0:3000`), so the
app is reachable from your LAN and over a VPN into your LAN. `datos/` is mounted
as a volume; the entrypoint seeds the data files on first run without
overwriting existing ones. `auth.json` is created at runtime inside the volume
and is never baked into the image. The container has a healthcheck on
`/api/health`.

### Deploy on an Ubuntu server (LAN + VPN access)

```bash
# On the server (Docker + Docker Compose plugin installed):
git clone <your-repo> gimnasio && cd gimnasio/app   # or copy the folder
cp .env.example .env                                 # edit if needed
docker compose up -d --build
```

Then open it from any device on your LAN (or connected through your VPN):

```
http://<server-LAN-IP>:3000      e.g. http://192.168.1.50:3000
```

Log in with `test` / `test` and change the credentials from the **Cuenta**
button right away.

Notes for this setup:

- **No CORS/Origin issues.** The same-origin check compares the browser `Origin`
  with the `Host` header, so accessing `http://192.168.1.50:3000` works as-is.
  Cross-site requests are still blocked.
- **Keep `COOKIE_SECURE=false`** (the default) while serving over plain HTTP. The
  session cookie is `HttpOnly; SameSite=Strict`; marking it `Secure` over HTTP
  would stop it from being sent. Set it to `true` only if you add HTTPS.
- **Ubuntu firewall (if UFW is on):** `sudo ufw allow 3000/tcp` (or restrict it to
  your VPN subnet, e.g. `sudo ufw allow from 10.0.0.0/24 to any port 3000`).
- **PWA install/offline needs HTTPS** with a *trusted* certificate. Over plain
  LAN HTTP the app works fully but isn't installable (the service worker needs a
  secure context). See the next section to enable it.
- **Updates:** `git pull && docker compose up -d --build`. Your `datos/` volume
  (recipes, plan, log, credentials) is preserved across rebuilds.

### HTTPS + installable PWA (reverse proxy)

A second compose file, `docker-compose.https.yml`, puts a **Caddy** reverse proxy
in front of the app. Caddy obtains and auto-renews a trusted TLS certificate;
that valid cert is what makes the PWA installable and enables the service worker.
It also sets `COOKIE_SECURE=true` and `TRUST_PROXY=1` for you, and the app is no
longer exposed directly (only Caddy listens on 80/443).

```bash
cp .env.example .env
# set DOMAIN=menu.midominio.com  (and TLS_EMAIL, ANTHROPIC_API_KEY)
docker compose -f docker-compose.https.yml up -d --build
```

Then open `https://menu.midominio.com`, log in, and use the browser's
**Install app** action.

Pick the mode that matches your network:

- **Public domain (recommended).** Point a domain you own at the server and make
  ports 80/443 reachable from the internet (port-forward). Caddy gets a free
  Let's Encrypt certificate automatically — nothing else to do. You can still
  restrict actual access to your VPN/LAN at the firewall while leaving 80/443
  open just for the ACME challenge, or use the DNS option below.
- **Internal only (VPN/LAN, no public ports).** Use a domain whose DNS resolves
  to the server's private IP (your router/Pi-hole or `/etc/hosts`), and either:
  - uncomment `tls internal` in the `Caddyfile` and install Caddy's root CA on
    each device (then the local cert is trusted and the PWA installs), or
  - use a Caddy build with a DNS-provider plugin and the ACME **DNS-01**
    challenge to get a real Let's Encrypt cert without opening any port.
- **Firewall:** `sudo ufw allow 80/tcp && sudo ufw allow 443/tcp` (or scope them
  to your VPN subnet).

`caddy_data` (a named volume) keeps the certificates across restarts.
