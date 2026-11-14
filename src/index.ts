import { Hono } from "hono";
import type { AppEnv } from "./lib/app-env";
import { notFound, onError } from "./middleware/errors";
import { requestId } from "./middleware/request-id";
import { securityHeaders } from "./middleware/security-headers";
import { apiRoutes } from "./routes/api";
import { redirectRoutes } from "./routes/redirect";

const app = new Hono<AppEnv>();

app.use("*", requestId(), securityHeaders());
app.onError(onError);
app.notFound(notFound);

app.get("/healthz", (c) => c.json({ ok: true }));
app.route("/api/v1", apiRoutes());

// Last: `/:id` matches any single segment, so every named route must be registered above it.
app.route("/", redirectRoutes());

export default {
  fetch: app.fetch,
  scheduled(controller: ScheduledController): void {
    console.info(`scheduled run at ${new Date(controller.scheduledTime).toISOString()}`);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
