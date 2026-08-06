# F1 Analytics

A Formula 1 analytics application for enthusiasts — seasons, races, drivers, teams and circuits,
compared across eras. React + TypeScript client, Hono + SQLite API. Read-only: no accounts, no
mutations, and no third-party network calls on any request path.

## Requirements

| | |
|---|---|
| Node | **≥ 22.22.0** — `.nvmrc` pins **22.23.2**. `npm install` enforces the floor via `engines`. |
| npm | 10+ (ships with Node 22) |

```bash
nvm use          # reads .nvmrc
node -v          # must report v22.22.0 or later
```

The floor is not arbitrary: `react-router@8` requires it, and it is the version on which the whole
dependency tree audits clean.

## The database

The application reads one local SQLite file at **`data/f1.db`** (~66 MB).

**That file is supplied separately and is not part of this repository** — `data/` is gitignored, so a
fresh clone does not have it. Put the file at `data/f1.db`, relative to the project root, or point
`F1_DB_PATH` at another location.

The connection is opened **read-only** and the application never writes to it. Note that the
directory holding the file must be **writable** by the server process: the database is in WAL mode,
and SQLite creates its `-shm`/`-wal` sidecar files even to read.

Without the file the app still runs — the API answers `503` and the client renders a state that tells
you what to do about it. Nothing crashes and nothing prints a stack trace.

## Quick start

```bash
npm install
# place the database at data/f1.db
npm run dev
```

`npm run dev` starts both halves: the client on **http://localhost:5173** and the API on **:8787**,
with `/api` proxied so the browser sees one origin. Open the client.

Copy `.env.example` to `.env` only if you need to change `PORT` or `F1_DB_PATH`. Neither is required,
and there are no secrets in this application.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | client + API together (`dev:web` and `dev:api` also run individually) |
| `npm run build` | typecheck the whole project, then build the client into `dist/` |
| `npm run start` | serve the built client **and** the API from one origin on `:8787` (`NODE_ENV=production`) |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run lint` | ESLint, type-aware |
| `npm run format` / `format:check` | Prettier write / verify |
| `npm test` / `test:watch` | Vitest |
| `npm run db:sql` | a read-only `sqlite3` shell on the database |

`npm run start` needs a build first; run `npm run build && npm run start`.

## Where things are

| Path | Contents |
|---|---|
| `server/` | Hono API — `queries/` holds all SQL, `schemas/` the Zod contracts |
| `src/` | React client — `features/` (hooks + pure selectors), `components/`, `lib/`, `styles/` |
| `db/schema.sql` | the schema the application expects |
| `docs/ARCHITECTURE.md` | stack, layering rules, API surface, security posture, budgets |
| `docs/DATABASE.md` | schema reference, canonical queries, and the traps that cause silent bugs |
| `docs/DESIGN_SYSTEM.md` | typography, colour, motion and component specifications |
| `PLAN.md` · `REQUIREMENTS.md` | what is being built, in what order, and what the data supports |

The three vendored typefaces in `public/fonts/` are used under the SIL Open Font License 1.1; the
licence and its copyright notices are in `public/fonts/OFL.txt`.
