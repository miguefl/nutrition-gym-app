# Migration plan: JSON files → SQLite

> Status: **planned, not implemented.** Tracked on branch `feature/sqlite-migration`.
> 🇪🇸 Resumen en español al final.

## Why (and when)

Today the app persists data as JSON files under `datos/` with atomic writes
(`tmp` + rename), a per-file in-process lock, and versioned backups. For a single
user on a home network this is robust and simple — **no database is needed yet.**

Consider migrating to **SQLite** when any of these appear:

- Multiple users / per-user data spaces.
- The adherence log (`registro.json`) accumulates years of data and full-file
  reads/writes start to feel slow.
- You want richer queries (filter recipes by ingredient/macros server-side,
  stats over the log, etc.) or real referential integrity.

SQLite is the right next step (not Mongo/Redis): it stays a single file inside
the same `datos/` volume (trivial backup), needs no extra service, and gives
transactions, indexes and SQL. Redis would only make sense as a session/rate-limit
store if you ever run **multiple instances**; Mongo adds an extra server with no
benefit over SQLite here.

## What makes this migration small

The backend is already layered **controller → service → repository**. Only the
**repository layer** (`src/repositories/`) touches storage. Services, routes,
validation and the whole frontend stay untouched as long as the repositories keep
returning the same shapes (the Spanish-keyed objects: `nombre`, `tipo_comida`,
`ingredientes`, `cat`, `gPorBloque`, `estado`, …).

Files that change: `src/repositories/*.js`, `src/config.js` (DB path/env), a new
`src/repositories/db.js`, `package.json` (add `better-sqlite3`), `Dockerfile`
(build deps for the native module). Plus a one-off import script.

Files that DON'T change: `src/services/*`, `src/routes/*`, `src/validation.js`,
`src/middleware/*`, `public/**`, and the tests' expectations (the integration
tests run against whatever the repositories return).

## Recommended library

`better-sqlite3` — synchronous, fast, well maintained. Synchronous fits our
repositories cleanly (they already serialize writes); no callback/promise churn.
Note it is a **native module**, so the Docker image needs build tools (see below).

## Proposed schema

```sql
CREATE TABLE recipes (
  id          INTEGER PRIMARY KEY,
  nombre      TEXT NOT NULL,
  nombre_norm TEXT NOT NULL UNIQUE,          -- lower(nombre), for dedupe/lookups
  tipo_comida TEXT NOT NULL,                 -- desayuno|comida|merienda|cena
  ingredientes TEXT NOT NULL,                -- JSON array (kept as-is)
  macros       TEXT NOT NULL DEFAULT '{}'    -- JSON object
);

CREATE TABLE aliases (
  nombre_norm     TEXT PRIMARY KEY,          -- normalized name
  nombre          TEXT NOT NULL,
  cat             TEXT NOT NULL,
  gPorBloque      REAL,
  unidadBloque    REAL,
  gramosPorUnidad REAL,
  libre           INTEGER NOT NULL DEFAULT 0,
  justificacion   TEXT,
  fuentes         TEXT NOT NULL DEFAULT '[]',-- JSON array
  approved_at     TEXT
);

-- Plan: one row per (day, meal). recipe_name is a soft reference by name,
-- matching today's behaviour (a deleted recipe shows as "(eliminada)").
CREATE TABLE plan (
  dia    TEXT NOT NULL,                       -- lunes..domingo
  comida TEXT NOT NULL,                       -- desayuno..cena
  receta TEXT,                                -- recipe name or NULL
  PRIMARY KEY (dia, comida)
);

CREATE TABLE log (
  fecha  TEXT NOT NULL,                       -- YYYY-MM-DD
  comida TEXT NOT NULL,
  estado TEXT NOT NULL,                       -- ok|fallo
  PRIMARY KEY (fecha, comida)
);

-- equivalencias.json stays a static read-only reference; either keep it as a
-- file or load it into a small key/value table. No writes happen to it.

-- auth stays exactly as today (datos/auth.json): credentials + session secret.
-- Out of scope for the DB migration.
```

`ingredientes`/`macros`/`fuentes` are stored as JSON text so the repository
returns the **exact same object shapes** the rest of the app already expects.
(Optionally, later, normalize ingredients into their own table for server-side
ingredient queries.)

## Step-by-step

1. **Branch:** `feature/sqlite-migration` (already created).
2. `npm i better-sqlite3`.
3. `src/config.js`: add `paths.db` (e.g. `datos/menu.db`) + `DB_PATH` env override.
4. `src/repositories/db.js`: open the DB, set `PRAGMA journal_mode=WAL;`, run
   `CREATE TABLE IF NOT EXISTS …` (migrations).
5. Rewrite each repository against the DB, keeping the **same function
   signatures and return shapes**:
   - `recipesRepository`: `findAll`, `insertIfAbsent`, `replaceByName`, `removeByName`.
   - `aliasesRepository`: `findAll`, `upsert`, `removeByName`.
   - `planRepository`: `get`, `replace` (transaction: clear + insert rows).
   - `logRepository`: `get`, `setEntry` (upsert / delete on null estado).
   - `equivalencesRepository`: `findAll` (from file or a seed table).
   Wrap multi-row writes in `db.transaction(...)`.
6. **Import script** `scripts/import-json-to-sqlite.js`: read the existing
   `datos/*.json` and insert into the DB (idempotent). Run once on the server.
7. `Dockerfile`: native module needs build tools in the deps stage:
   ```dockerfile
   FROM node:22-alpine AS deps
   RUN apk add --no-cache python3 make g++
   ...
   ```
   (Runtime stage stays slim; only the compiled `.node` is copied with node_modules.)
8. **Tests:** unit/integration mostly pass unchanged. Point `DATA_DIR`/`DB_PATH`
   at a temp DB in tests; add a couple of repository-level tests for transactions
   and the upsert/delete paths. The versioning behaviour can be replaced by
   periodic `VACUUM INTO 'backup.db'` snapshots if you still want backups.
9. Update `README`/`README.es` (storage section) and `docker-compose*.yml` if the
   DB path/volume differs (the `./datos` volume already covers `menu.db`).

## Rollback / safety

- Keep the JSON repositories on `main`; the DB work lives on the branch until proven.
- The import script is additive (doesn't delete JSON). Keep a JSON export
  (`GET /api/backup`) before switching.
- WAL mode + the existing single-instance deployment means no locking surprises.

---

## Resumen (ES)

Hoy los datos viven en ficheros JSON y, para un solo usuario, es suficiente y
robusto: **no hace falta base de datos todavía**. El día que quieras multiusuario,
búsquedas server-side o que el registro acumule años sin perder rendimiento, el
salto natural es **SQLite** (un solo fichero dentro del volumen `datos/`, con
transacciones e índices; ni Mongo ni Redis aportan aquí). Como el acceso a datos
ya está aislado en la capa de **repositorios**, la migración se limita a reescribir
`src/repositories/*` manteniendo las mismas firmas y formas de retorno; servicios,
rutas, validación y todo el frontend no se tocan. Los pasos detallados están arriba;
el trabajo se hará en la rama `feature/sqlite-migration`.
