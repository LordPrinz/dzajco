import type { VisitPoint, VisitSink } from "./ports";

type GeoFields = { country?: unknown; city?: unknown; latitude?: unknown; longitude?: unknown };

function coordinate(value: unknown): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Builds the visit for `linkId` from `request.cf`, whose latitude and longitude are strings.
 * `createdAt` is the link's creation time: it tells apart two links that used the same id.
 */
export function visitPoint(
  linkId: string,
  createdAt: number,
  cf: GeoFields | undefined,
): VisitPoint {
  return {
    linkId,
    createdAt,
    country: typeof cf?.country === "string" ? cf.country : "",
    city: typeof cf?.city === "string" ? cf.city : "",
    lat: coordinate(cf?.latitude),
    lon: coordinate(cf?.longitude),
  };
}

/** Writes visits to Analytics Engine. Doubles are left out unless both coordinates are known. */
export function aeSink(dataset: Pick<AnalyticsEngineDataset, "writeDataPoint">): VisitSink {
  return {
    write(point) {
      try {
        dataset.writeDataPoint({
          indexes: [point.linkId],
          blobs: [point.country, point.city, String(point.createdAt)],
          doubles: point.lat !== null && point.lon !== null ? [point.lat, point.lon] : [],
        });
      } catch {
        console.warn("analytics: writeDataPoint failed");
      }
    },
  };
}
