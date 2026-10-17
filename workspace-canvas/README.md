# Workspace Canvas — concept prototype

One homepage for making anything in Workspace. Place seeds (notes, directions, sources, images, Workspace items, assumptions) on a spatial canvas. A live draft of the output, a doc or a deck, renders beside them and updates as you steer.

*Concept prototype · sample data.* All emails, meetings, files and chats are fictional and live in `src/data/workspace.json`. It uses no product logos.

## Start it

You need [Node.js](https://nodejs.org) 18 or newer. Then, in this folder:

```bash
npm start
```

This installs everything the first time and opens **http://localhost:5180** in your browser. After that, `npm run dev` starts it faster.

### Turn on AI writing (optional)

1. Copy `.env.example` to a file named `.env` in this folder.
2. Paste your Anthropic API key after `ANTHROPIC_API_KEY=`.
3. Restart `npm start`.

The key is read by the small local server only. It is never sent to the browser. With no key, the prototype still works: a built-in local writer drafts everything, and the landing page says so.

Optional settings in `.env`:
- `ANTHROPIC_MODEL`: which model writes (default `claude-opus-5-5`).
- `ANTHROPIC_EFFORT`: `low`, `medium` or `high`. The default is `low`, which is fastest.

## How the live draft works

Each change moves through these tiers:

| When | What you see |
| --- | --- |
| Under 100 ms | The parts of the draft your change touches shimmer. |
| Under 400 ms | A fast local pass rebuilds the structure: title, sections, order, tables, scenarios and the modeled outcome. |
| 2–5 s | Claude rewrites the text of only the parts whose inputs changed, streamed into place. |
| Afterwards | The title and summary are polished last. |

A newer change cancels any update in progress. AI text is cached per part, so unchanged parts never regenerate, and reopening a canvas restores it instantly. If the model is slow or fails, the last good draft stays and the status line says so quietly.

## Tests

```bash
npx playwright test            # the three flows, AI streaming (simulated), and screenshots
npx playwright test --project=screens   # just the screenshots, saved to screens/
```

The tests start their own servers. The streaming test uses a simulated AI (`WC_FAKE_AI=1`), so it never spends API credits.

## Where things are

- `src/engine/`: the local pass. It classifies lines, groups and orders seeds, builds scenarios, runs the outcome model, and turns the outline into draft parts.
- `src/draft/pipeline.ts`: the fidelity tiers, cancellation, the AI cache, pins, edits and conflicts.
- `server/`: the local API (a Vite plugin) and the prompt.
- `src/components/`: the landing page, top bar, board, cards, toolbar, list view and draft panel.
- `src/styles/`: Material 3 tokens for light and dark, plus app and draft styles.
