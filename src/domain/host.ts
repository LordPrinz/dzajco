const MAX_HOST_LENGTH = 253;

export function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.+$/, "");
}

/** Normalises a bare host the same way `insertLink` stores `target_host` (punycode, lowercase, no trailing dot). */
export function normalizeHost(input: string): string {
  const trimmed = input.trim();
  if (trimmed === "" || trimmed.length > MAX_HOST_LENGTH || /[\s/:@?#\\]/.test(trimmed)) {
    throw new Error(`Not a bare host: ${input}`);
  }
  return normalizeHostname(new URL(`http://${trimmed}`).hostname);
}
