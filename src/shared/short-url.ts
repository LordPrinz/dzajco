// Shared by the server views and the browser scripts, so keep it free of runtime imports.

/** `https://dzaj.de/abc` as `dzaj.de/abc`, for display. Links and Copy keep the full URL. */
export function withoutProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "");
}
