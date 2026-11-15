// Shared by the server views and the browser scripts, so keep it free of runtime imports.

/** `https://dzaj.de/abc` as `dzaj.de/abc`, for display. Links and Copy keep the full URL. */
export function withoutProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

/** The link code from what someone pasted: a full short URL or the bare code, spaces around allowed. */
export function codeFromInput(input: string): string {
  const value = input.trim();
  if (!URL.canParse(value)) return value;
  const segment = new URL(value).pathname.split("/")[1] ?? "";
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
