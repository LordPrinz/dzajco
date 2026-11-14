import { Hono } from "hono";
import { redirectRoutes } from "./routes/redirect";

const app = new Hono<{ Bindings: Cloudflare.Env }>();

app.get("/healthz", (c) => c.json({ ok: true }));

// Last: `/:id` matches any single segment, so every named route must be registered above it.
app.route("/", redirectRoutes());

export default {
  fetch: app.fetch,
  scheduled(controller: ScheduledController): void {
    console.info(`scheduled run at ${new Date(controller.scheduledTime).toISOString()}`);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
