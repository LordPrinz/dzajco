import { Hono } from "hono";
import { runScheduled } from "./cron/scheduled";

const app = new Hono<{ Bindings: Cloudflare.Env }>();

app.get("/healthz", (c) => c.json({ ok: true }));

export default {
  fetch: app.fetch,
  scheduled(controller: ScheduledController, env: Cloudflare.Env): Promise<void> {
    return runScheduled(env, controller.scheduledTime);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
