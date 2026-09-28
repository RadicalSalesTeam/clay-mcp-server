import crypto from "node:crypto";
import express, { NextFunction, Request, Response } from "express";

const PORT = Number(process.env.PORT ?? 3000);
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

const app = express();
app.use(express.json({ limit: "1mb" }));

function checkSecret(req: Request, res: Response, next: NextFunction): void {
  if (!WEBHOOK_SECRET) {
    next();
    return;
  }

  const provided = req.header("x-webhook-secret") ?? "";
  const expected = Buffer.from(WEBHOOK_SECRET);
  const actual = Buffer.from(provided);

  const isValid =
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual);

  if (!isValid) {
    res.status(401).json({ error: "invalid webhook secret" });
    return;
  }

  next();
}

app.post("/webhook/notifications", checkSecret, (req: Request, res: Response) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    headers: req.headers,
    body: req.body,
  }));

  res.status(200).json({ received: true });
});

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
