# clay-mcp-server
MCP server to connect Clay.com with Claude

## Webhook receiver

`src/server.ts` exposes a small Express server that accepts incoming webhook
notifications and logs them.

```bash
npm install
npm run dev     # runs with tsx, auto-reload
# or
npm run build && npm start
```

- `POST /webhook/notifications` — accepts any JSON payload, logs it
  (timestamp, headers, body) and responds `200 { "received": true }`.
- `GET /health` — health check.

### Configuration

| Env var          | Description                                                                 |
| ---------------- | ---------------------------------------------------------------------------- |
| `PORT`           | Port to listen on (default `3000`).                                          |
| `WEBHOOK_SECRET` | If set, requests must include a matching `x-webhook-secret` header, otherwise they get `401`. Leave unset to accept any request. |

### Deploying to Railway

The repo includes `railway.json` (build with `npm run build`, run with `npm start`) so Railway's Nixpacks builder picks it up with no extra config. To go live:

1. On [railway.app](https://railway.app), **New Project → Deploy from GitHub repo** and pick `clay-mcp-server`.
2. Set the branch to deploy (e.g. `main`, or this feature branch while testing).
3. Under **Variables**, optionally set `WEBHOOK_SECRET` (Railway sets `PORT` itself — no need to add it).
4. Under **Settings → Networking**, click **Generate Domain** to get a public `https://<project>.up.railway.app` URL.
5. Your webhook endpoint is then `https://<project>.up.railway.app/webhook/notifications`.

Every push to the connected branch triggers a new deploy automatically.
