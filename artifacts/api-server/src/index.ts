import { validateAllSecrets } from "./lib/secrets.js";
import app from "./app";
import { logger } from "./lib/logger";

// ─── Fail-fast secret validation ─────────────────────────────────────────────
// Checks JWT_SECRET, SESSION_SECRET, IBAN_SECRET:
//   • All present (required in production, warned in development)
//   • All ≥ 32 characters
//   • All DISTINCT from each other
validateAllSecrets();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
