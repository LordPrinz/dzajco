import { createVisitSource } from "../analytics/ae-source";
import { loadFresh, parseFreshTtl } from "../analytics/fresh";
import { mergeCountries } from "../analytics/merge";
import { type CountryStat, publicStats } from "../db/queries";

export interface PublicLinkStats {
  visits: number;
  countries: CountryStat[];
  /** True when Analytics Engine could not be read and only the rolled-up D1 numbers are shown. */
  partial: boolean;
}

/** Rolled-up D1 stats plus the fresh Analytics Engine rows of one link; never includes cities. */
export async function loadPublicStats(
  env: Cloudflare.Env,
  id: string,
  now: number,
): Promise<PublicLinkStats> {
  const d1 = await publicStats(env.DB, id);
  const fresh = await loadFresh({
    source: () => createVisitSource(env),
    cursor: d1.cursor,
    now,
    ttlSeconds: parseFreshTtl(env.AE_FRESH_TTL),
  });
  const { visits, countries } = mergeCountries(d1, fresh.rows, id, d1.createdAt);
  return { visits, countries, partial: fresh.partial };
}
