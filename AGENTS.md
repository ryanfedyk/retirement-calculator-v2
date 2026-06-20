<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Workflow conventions

- **Production deploys from `main`** (Firebase App Hosting redeploys on push to `main`). Ship changes via a PR into `main`, not by leaving commits stranded on a branch.
- **CI gates merges.** `.github/workflows/ci.yml` runs `tsc --noEmit` + `next build` on every PR. Keep it green.
- **Auto-watch PRs you open.** After creating a PR, subscribe to its activity and babysit it (fix CI failures, answer review comments) until it merges. Enable auto-merge so it merges itself once CI is green.
- **Don't push more commits to a branch whose PR has already merged** — open a fresh PR for follow-up work so changes aren't stranded out of `main`.
