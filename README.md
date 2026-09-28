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
