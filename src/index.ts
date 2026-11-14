import { Hono } from "hono";
import { runScheduled } from "./cron/scheduled";
import type { AppEnv } from "./lib/app-env";
import { notFound, onError } from "./middleware/errors";
import { requestId } from "./middleware/request-id";
import { securityHeaders } from "./middleware/security-headers";
import { apiRoutes } from "./routes/api";
import { pageRoutes } from "./routes/pages";
import { redirectRoutes } from "./routes/redirect";
import { statsRoutes } from "./routes/stats";
import { statsPageRoutes } from "./routes/stats-page";

const app = new Hono<AppEnv>();

app.use("*", requestId(), securityHeaders());
app.onError(onError);
app.notFound(notFound);

app.get("/healthz", (c) => c.json({ ok: true }));
app.route("/api/v1", apiRoutes());
app.route("/api/v1", statsRoutes());
app.route("/", pageRoutes());
app.route("/", statsPageRoutes());

// Last: `/:id` matches any single segment, so every named route must be registered above it.
app.route("/", redirectRoutes());

export default {
  fetch: app.fetch,
  scheduled(controller: ScheduledController, env: Cloudflare.Env): Promise<void> {
    return runScheduled(env, controller.scheduledTime);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
