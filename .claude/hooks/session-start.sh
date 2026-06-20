#!/bin/bash
set -euo pipefail

# Claude Code on the web starts from a fresh clone with no node_modules. Install
# dependencies so typecheck/build (and any future tests/linters) work without
# manual setup. Runs only in remote (web) sessions; local sessions are untouched.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# `npm install` (not `npm ci`) so the cached container layer is reused across
# sessions and the install is incremental.
npm install
