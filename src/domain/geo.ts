/** A coordinate rounded to 2 decimals (about 1 km); null when it is missing or not finite. */
export function roundCoord(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}
