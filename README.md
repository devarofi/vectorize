# Vectorize

A browser-based vector graphics editor built with JavaScript, SVG, and Jetz.

## Requirements

- Node.js 20 or newer
- pnpm 9 or newer

## Run locally

```bash
pnpm install
pnpm start
```

Open the local URL printed by Vite (normally http://localhost:5173). The editor is available at:

- `/` — redirects to the editor
- `/editor` — editor workspace

Vite's SPA fallback supports refreshing or directly opening `/editor`.

## Available scripts

| Command | Purpose |
|---|---|
| `pnpm start` | Start the local development server |
| `pnpm dev` | Alias for the development server |
| `pnpm build` | Build the production bundle into `dist/` |
| `pnpm preview` | Preview the production build |
| `pnpm test` | Run Node's built-in test runner |

## Initial editor shell

The current shell wires the existing document store, SVG renderer, and interaction controller into a small application UI. It includes selection, rectangle, ellipse, line, and pen tools, pan/zoom, undo/redo, a basic fill inspector, and a single-layer view. Advanced workflows are intentionally deferred to the engineering roadmap.
