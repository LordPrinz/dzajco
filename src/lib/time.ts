export function isoOrNull(at: number | null): string | null {
  return at === null ? null : new Date(at).toISOString();
}
