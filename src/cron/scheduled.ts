import { createVisitSource } from "../analytics/ae-source";
import { runDaily } from "./daily";
import { d1RollupStore, parseMaxPages, runRollup } from "./rollup";

/**
 * Hourly cron: the rollup first, so the daily `global_stats` sees its pages. A failed rollup does
 * not block the daily step. Without SQL API credentials the rollup is skipped and the cursor stays
 * put: rolling up from the empty local source would close days as empty and lose their visits.
 */
export async function runScheduled(env: Cloudflare.Env, now: number): Promise<void> {
  const configured = Boolean(env.CF_ACCOUNT_ID && env.CF_AE_TOKEN);
  let failed = false;
  if (!configured) {
    console.info("rollup skipped: analytics source not configured");
  } else {
    try {
      const result = await runRollup({
        store: d1RollupStore(env.DB),
        source: createVisitSource(env),
        now,
        maxPages: parseMaxPages(env.ROLLUP_MAX_PAGES),
      });
      console.info("rollup", JSON.stringify(result));
    } catch (error) {
      failed = true;
      console.error("rollup failed", error);
    }
  }
  try {
    await runDaily(env.DB, now, configured);
  } catch (error) {
    failed = true;
    console.error("daily step failed", error);
  }
  if (failed) throw new Error("scheduled run failed");
}
