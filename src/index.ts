import { Hono } from "hono";
import { runScheduled } from "./cron/scheduled";
import { redirectRoutes } from "./routes/redirect";

const app = new Hono<{ Bindings: Cloudflare.Env }>();

app.get("/healthz", (c) => c.json({ ok: true }));

// Last: `/:id` matches any single segment, so every named route must be registered above it.
app.route("/", redirectRoutes());

export default {
  fetch: app.fetch,
  scheduled(controller: ScheduledController, env: Cloudflare.Env): Promise<void> {
    return runScheduled(env, controller.scheduledTime);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
