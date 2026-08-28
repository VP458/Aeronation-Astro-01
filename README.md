# Aeronation-Astro-01

Astro app, server-rendered on Cloudflare Workers with a D1 (SQLite) database.
GitHub CLI, Cloudflare CLI (Wrangler), and MCP servers are pre-configured for
Claude Code.

## Reconnaître Recon configurator (`/`)

The site root is a browser-based turntable configurator for the Recon VTOL
fixed-wing surveillance drone — **Path B** (pre-rendered frame scrubber),
chosen because Phase 0 found no 3D geometry in the repo, git history, or
Google Drive (Cloudflare R2 still needs a local `wrangler r2 bucket list`
check — no API token was available in the build session).

- Architecture, honesty rules, and the geometry swap-in path:
  [`docs/CONFIGURATOR.md`](docs/CONFIGURATOR.md)
- Option schema (single source of truth): [`src/config/options.ts`](src/config/options.ts),
  grounded in [`docs/spec-sources.md`](docs/spec-sources.md) — unsourced
  values are placeholder-flagged and render amber with an UNVERIFIED banner
- Reference photo catalogue: [`assets/reference/MANIFEST.md`](assets/reference/MANIFEST.md);
  run [`scripts/ingest-assets.sh`](scripts/ingest-assets.sh) locally to pull
  the full-res shoot and fill in the visual catalogue
- Frame sequences are **clearly-marked schematic placeholders**
  (`npm run frames:placeholder` regenerates); swap-in steps for real renders
  or a Path A Three.js viewer are in `docs/CONFIGURATOR.md`
- Deep-linkable builds: state serialises to the query string, e.g.
  `/?colourway=maritime-dark&payload=stereo-vision&endurance=standard&az=15`

The D1 demo that previously lived at `/` is now at `/demo`.

- **Framework**: Astro 5 (`output: "server"`) + `@astrojs/cloudflare` adapter
- **Database**: Cloudflare D1, bound as `DB` (see [`wrangler.jsonc`](wrangler.jsonc))
- **Demo**: `src/pages/index.astro` lists rows from D1; `src/pages/api/items.ts`
  exposes `GET`/`POST /api/items`

## Quick start

```bash
# 0. One-time: install the GitHub CLI and Wrangler, then authenticate
./scripts/setup-clis.sh
gh auth login        # opens a browser — sign in to GitHub
wrangler login       # opens a browser — sign in to Cloudflare

# 1. Install dependencies
npm install

# 2. Create the local D1 database (migration + sample rows)
npm run db:migrate:local
npm run db:seed:local

# 3. Develop
npm run dev          # http://localhost:4321 — D1 proxied into astro dev
```

## Deploying to Cloudflare

```bash
# 1. Create the production D1 database (one time)
npm run db:create
#    → copy the printed database_id into wrangler.jsonc ("database_id": "...")

# 2. Apply migrations + optional seed to the remote database
npm run db:migrate:remote
npm run db:seed:remote

# 3. Build and deploy the Worker
npm run deploy
```

`npm run preview` builds and serves the production Worker locally via
`wrangler dev` (uses the local D1 copy in `.wrangler/state/`).

## Database workflow

- Add a new migration as `migrations/000N_description.sql`, then run
  `npm run db:migrate:local` (and `:remote` when deploying).
- Inspect data: `wrangler d1 execute aeronation-db --local --command "SELECT * FROM items"`.
- The `DB` binding is typed in [`src/env.d.ts`](src/env.d.ts) and available in
  pages/endpoints as `Astro.locals.runtime.env.DB` / `locals.runtime.env.DB`.
- After changing bindings in `wrangler.jsonc`, regenerate types with
  `npm run cf-typegen` and update `src/env.d.ts` if needed.

## MCP servers (Claude Code)

The project-scoped [`.mcp.json`](.mcp.json) configures these remote MCP servers.
They are checked into the repo, so anyone who opens this project in Claude Code
gets them automatically:

| Server | What it does | Auth |
|--------|--------------|------|
| `github` | Repos, PRs, issues, Actions via the official GitHub MCP server | OAuth |
| `cloudflare-docs` | Search Cloudflare documentation | none |
| `cloudflare-bindings` | Manage Workers/Pages, KV, R2, D1 bindings | OAuth |
| `cloudflare-builds` | Inspect Workers Builds (CI) | OAuth |
| `cloudflare-observability` | Query Workers logs and analytics | OAuth |

To authenticate them, open this project in Claude Code and run:

```
/mcp
```

then select each server and complete the browser OAuth flow. The docs server
needs no login. `.claude/settings.json` pre-approves the project's `.mcp.json`
servers so you won't be prompted to trust them each session.

More Cloudflare MCP servers (AI Gateway, AutoRAG, Radar, Logpush, …) are listed
at <https://github.com/cloudflare/mcp-server-cloudflare> — add any of them to
`.mcp.json` the same way, using their `https://<name>.mcp.cloudflare.com/mcp` URL.

## CLI cheat sheet

### GitHub CLI

```bash
gh repo view                 # this repo's details
gh pr create --fill          # open a PR from the current branch
gh pr list                   # open PRs
gh run list                  # recent GitHub Actions runs
```

### Wrangler (Cloudflare)

```bash
wrangler whoami                          # verify login / account
wrangler deploy                          # deploy the Worker (or: npm run deploy)
wrangler deployments list                # recent Worker deployments
wrangler tail                            # live production logs
wrangler d1 info aeronation-db           # D1 database details
```

## CI / non-interactive auth

For scripts and CI, use tokens instead of browser login:

- **GitHub**: set `GH_TOKEN` (a fine-grained PAT) — `gh` picks it up automatically.
- **Cloudflare**: set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` — Wrangler
  picks them up automatically. Create tokens at *Cloudflare dashboard → My Profile →
  API Tokens* (the "Edit Cloudflare Workers" template covers most needs).

Never commit tokens — keep them in CI secrets or a local `.env` (gitignored).
