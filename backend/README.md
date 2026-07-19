# UI Copy-Paste — backend

Thin proxy: extension sends `ExtractedNode` / screenshot → backend builds the prompt → LLM → clean React component.

**BYOK only.** The user's API key arrives in the request body, is used for that call, and is never logged or stored.

## Endpoints

- `GET /health` → `{ ok, service, byok }`
- `POST /generate` — body `GenerateRequest` (Zod), response `{ code, componentName, warnings }`
- `POST /generate/stream` — SSE stream (`delta` / `done` / `error`)

Optional: `Authorization: Bearer <token>` if `BACKEND_AUTH_TOKEN` is set.

## Setup

**Windows:** double-click `start-backend.bat`.

```bash
cd backend
pnpm install --ignore-workspace
cp .env.example .env
pnpm dev                          # http://localhost:8799
```

```bash
curl http://localhost:8799/health
```

## Env

| Variable | Description |
|---|---|
| `PORT` | Default `8799` |
| `BACKEND_AUTH_TOKEN` | Optional shared Bearer for the extension |

No provider keys in env — keys come from the extension (BYOK).

## Post-processing pipeline

1. **extract-code** — pull TSX from the model reply  
2. **fix-imports** — ensure `react` / `framer-motion` / `lucide-react`  
3. **validate** — esbuild `tsx` check; one automatic repair pass on failure  

## Deploy

Any Node host (Railway, Fly.io, VPS). Start: `pnpm build && pnpm serve`. Set `PORT` and optional `BACKEND_AUTH_TOKEN`.
