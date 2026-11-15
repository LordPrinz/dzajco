/**
 * The public short URL of a link, from `PUBLIC_ORIGIN`. A broken origin must not take a page down,
 * so it falls back to the path alone.
 */
export function shortUrlFor(env: { PUBLIC_ORIGIN: string }, id: string): string {
  const path = `/${encodeURIComponent(id)}`;
  try {
    return new URL(path, env.PUBLIC_ORIGIN).href;
  } catch {
    return path;
  }
}
