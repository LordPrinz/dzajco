/** DNS limit for a host name; it also caps a host at 127 labels for the blocklist suffix walk. */
export const MAX_HOST_LENGTH = 253;

/** True when a (punycode) host has an internationalised label; the server and the browser share this rule. */
export function hostIsIdn(hostname: string): boolean {
  return hostname.split(".").some((label) => label.startsWith("xn--"));
}

export function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.+$/, "");
}

/**
 * Normalises a bare host the same way `insertLink` stores `target_host` (punycode, lowercase, no
 * trailing dot). A bracketed IPv6 literal comes back in its compressed WHATWG form, e.g. `[2001:db8::1]`.
 */
export function normalizeHost(input: string): string {
  const trimmed = input.trim();
  if (/^\[[0-9a-fA-F:.]+\]$/.test(trimmed)) {
    try {
      return new URL(`http://${trimmed}`).hostname;
    } catch {
      throw new Error(`Not a bare host: ${input}`);
    }
  }
  if (trimmed === "" || trimmed.length > MAX_HOST_LENGTH || /[\s/:@?#\\]/.test(trimmed)) {
    throw new Error(`Not a bare host: ${input}`);
  }
  return normalizeHostname(new URL(`http://${trimmed}`).hostname);
}
