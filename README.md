# Vectorize

A browser-based vector graphics editor built with JavaScript, SVG, and Jetz.

## Requirements

- Node.js 22.x
- pnpm 9.15.9 (pinned through `packageManager`)

## Run locally

```bash
pnpm install
pnpm start
```

Open the local URL printed by Vite (normally http://localhost:5173). The editor is available at:

- `/` — redirects to the editor
- `/editor` — editor workspace

Vite's SPA fallback supports refreshing or directly opening `/editor`.

## Deploy to Vercel

The repository includes `vercel.json` configured for Vite:

- Framework: Vite
- Install command: `npx --yes pnpm@9.15.9 install --no-frozen-lockfile` (pins the pnpm executable for the initial install)
- Build command: `pnpm run build`
- Output directory: `dist`
- SPA rewrite: unknown application paths are served through `index.html`, so `/editor` works on direct navigation and refresh.

To deploy:

1. Import `devarofi/vectorize` in the [Vercel Dashboard](https://vercel.com/new).
2. Keep the project root as the repository root; the build and output settings are read from `vercel.json`.
3. Use Node.js 22.x in Project Settings; `package.json` also pins the build runtime to `22.x`.
4. Deploy. Subsequent pushes to `main` will trigger production deployments when the repository is connected to Vercel.

Before the first deployment, generate and commit `pnpm-lock.yaml` by running `pnpm install` locally. Once the lockfile is committed, change the Vercel install command to `pnpm install --frozen-lockfile` (or remove the override and let Vercel detect pnpm from `pnpm-lock.yaml`). No application environment variables are currently required by the frontend shell.

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
