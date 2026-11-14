const EMAIL = /^[^\s@<>"',;:\\()[\]?&%#=]+@[^\s@<>"',;:\\()[\]?&%#=]+$/;

/** A `mailto:` href for reporting abuse, or null when `ABUSE_EMAIL` is unset or not a plain address. */
export function reportAbuseLink(
  env: { ABUSE_EMAIL?: string },
  context: { linkId?: string } = {},
): string | null {
  const address = (env.ABUSE_EMAIL ?? "").trim();
  if (!EMAIL.test(address)) return null;
  const subject = context.linkId ? `Report abuse: link ${context.linkId}` : "Report abuse";
  return `mailto:${address}?subject=${encodeURIComponent(subject)}`;
}
