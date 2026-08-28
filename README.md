# Aeronation-Astro-01

Astro project deployed to Cloudflare, with GitHub CLI, Cloudflare CLI (Wrangler),
and MCP servers pre-configured for Claude Code.

## Quick start

```bash
# 1. Install the GitHub CLI and Wrangler
./scripts/setup-clis.sh

# 2. Authenticate both CLIs
gh auth login        # opens a browser — sign in to GitHub
wrangler login       # opens a browser — sign in to Cloudflare

# 3. Verify
gh auth status
wrangler whoami
```

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
wrangler pages project list              # list Cloudflare Pages projects
wrangler pages deploy dist               # deploy the Astro build output
wrangler pages deployment list           # recent deployments
```

For an Astro site on Cloudflare Pages, the usual flow is:

```bash
npm run build                # builds to ./dist
wrangler pages deploy dist --project-name aeronation-astro-01
```

Alternatively, connect the GitHub repo to Cloudflare Pages in the dashboard for
automatic deploys on push (build command `npm run build`, output dir `dist`).

## CI / non-interactive auth

For scripts and CI, use tokens instead of browser login:

- **GitHub**: set `GH_TOKEN` (a fine-grained PAT) — `gh` picks it up automatically.
- **Cloudflare**: set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` — Wrangler
  picks them up automatically. Create tokens at *Cloudflare dashboard → My Profile →
  API Tokens* (the "Edit Cloudflare Workers" template covers most needs).

Never commit tokens — keep them in CI secrets or a local `.env` (gitignored).
