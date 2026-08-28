#!/usr/bin/env bash
#
# setup-clis.sh — install the GitHub CLI (gh) and Cloudflare CLI (wrangler)
# for the Aeronation-Astro-01 project.
#
# Usage:  ./scripts/setup-clis.sh
#
# Supports: macOS (Homebrew), Debian/Ubuntu (apt), and any OS with npm
# (for wrangler). Safe to re-run — already-installed tools are skipped.

set -euo pipefail

info()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m ✓ \033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m ! \033[0m %s\n' "$*"; }

# ---------------------------------------------------------------------------
# GitHub CLI (gh)
# ---------------------------------------------------------------------------
if command -v gh >/dev/null 2>&1; then
  ok "GitHub CLI already installed: $(gh --version | head -1)"
else
  info "Installing GitHub CLI (gh)..."
  if command -v brew >/dev/null 2>&1; then
    brew install gh
  elif command -v apt-get >/dev/null 2>&1; then
    # Official apt repository — https://github.com/cli/cli/blob/trunk/docs/install_linux.md
    sudo mkdir -p -m 755 /etc/apt/keyrings
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null
    sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      | sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null
    sudo apt-get update -qq
    sudo apt-get install -y gh
  else
    warn "No brew or apt-get found. Install gh manually: https://cli.github.com"
  fi
  ok "GitHub CLI installed: $(gh --version | head -1)"
fi

# ---------------------------------------------------------------------------
# Cloudflare CLI (wrangler)
# ---------------------------------------------------------------------------
if command -v wrangler >/dev/null 2>&1; then
  ok "Wrangler already installed: $(wrangler --version 2>/dev/null | head -1)"
elif command -v npm >/dev/null 2>&1; then
  info "Installing Cloudflare Wrangler globally via npm..."
  npm install -g wrangler
  ok "Wrangler installed: $(wrangler --version 2>/dev/null | head -1)"
else
  warn "npm not found. Install Node.js first (https://nodejs.org), then run: npm install -g wrangler"
fi

# ---------------------------------------------------------------------------
# Authentication status + next steps
# ---------------------------------------------------------------------------
echo
info "Checking authentication status..."

if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    ok "GitHub CLI is authenticated."
  else
    warn "GitHub CLI is not authenticated. Run:  gh auth login"
  fi
fi

if command -v wrangler >/dev/null 2>&1; then
  if wrangler whoami 2>/dev/null | grep -qi 'associated with'; then
    ok "Wrangler is authenticated."
  else
    warn "Wrangler is not authenticated. Run:  wrangler login"
  fi
fi

echo
info "Done. See README.md for MCP server setup in Claude Code (/mcp to authenticate)."
