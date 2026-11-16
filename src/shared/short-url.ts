// Shared by the server views and the browser scripts, so keep it free of runtime imports.

/** `https://dzaj.de/abc` as `dzaj.de/abc`, for display. Links and Copy keep the full URL. */
export function withoutProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

/**
 * The link code from what someone pasted: a full short URL, one without `https://` as the site shows
 * it (`dzaj.de/abc`), or the bare code, spaces around allowed.
 */
export function codeFromInput(input: string): string {
  const value = input.trim();
  const url = URL.canParse(value) || !value.includes("/") ? value : `https://${value}`;
  if (!URL.canParse(url)) return value;
  const segment = new URL(url).pathname.split("/")[1] ?? "";
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
