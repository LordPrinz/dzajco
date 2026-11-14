import { Hono } from "hono";

const app = new Hono<{ Bindings: Cloudflare.Env }>();

app.get("/healthz", (c) => c.json({ ok: true }));

export default {
  fetch: app.fetch,
  scheduled(controller: ScheduledController): void {
    console.info(`scheduled run at ${new Date(controller.scheduledTime).toISOString()}`);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
