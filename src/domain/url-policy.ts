export const MAX_URL_LENGTH = 2048;

export const SHORTENER_HOSTS: readonly string[] = [
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "rebrand.ly",
  "cutt.ly",
  "shorturl.at",
  "tiny.cc",
];

export type TargetError =
  | "invalid_url"
  | "url_too_long"
  | "unsupported_scheme"
  | "credentials_not_allowed"
  | "own_host"
  | "private_target"
  | "blocked_target";

export type TargetResult =
  | { ok: true; url: string; host: string; isIdn: boolean }
  | { ok: false; code: TargetError };

/** The host and every parent domain, longest first: `a.b.c` gives `a.b.c`, `b.c`, `c`. */
export function hostSuffixes(host: string): string[] {
  const labels = host.toLowerCase().replace(/\.+$/, "").split(".");
  return labels.map((_, i) => labels.slice(i).join("."));
}

function matches(host: string, list: readonly string[]): boolean {
  return hostSuffixes(host).some((suffix) => list.includes(suffix));
}

function normalizeOwnHost(host: string): string {
  return host.toLowerCase().replace(/:\d+$/, "").replace(/\.+$/, "");
}

function isPrivateIPv4(a: number, b: number): boolean {
  return (
    a === 0 ||
    a >= 224 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/** Expands a normalized IPv6 literal (no brackets) into 8 groups, or null when malformed. */
function ipv6Groups(host: string): number[] | null {
  const halves = host.split("::");
  if (halves.length > 2) return null;
  const toGroups = (part: string) =>
    part === "" ? [] : part.split(":").map((g) => Number.parseInt(g, 16));
  const head = toGroups(halves[0] ?? "");
  const tail = toGroups(halves[1] ?? "");
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [
    ...head,
    ...new Array<number>(halves.length === 2 ? missing : 0).fill(0),
    ...tail,
  ];
  return groups.some(Number.isNaN) ? null : groups;
}

function isPrivateIPv6(host: string): boolean {
  const g = ipv6Groups(host);
  if (!g) return true;
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0] = g;
  const embeddedV4 = isPrivateIPv4(g6 >> 8, g6 & 0xff);
  const zeroPrefix = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
  if (zeroPrefix && g5 === 0 && (g6 === 0 || embeddedV4)) return true;
  if (zeroPrefix && g5 === 0xffff && embeddedV4) return true;
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0 && embeddedV4) {
    return true;
  }
  if (g0 === 0x2002) return true;
  return (g0 & 0xfe00) === 0xfc00 || (g0 & 0xffc0) === 0xfe80;
}

/** Works on the host as `new URL` normalizes it, so `0x7f.1` and `2130706433` arrive as `127.0.0.1`. */
export function isPrivateHost(host: string): boolean {
  if (host.startsWith("[")) return isPrivateIPv6(host.slice(1, -1));
  if (hostSuffixes(host).includes("localhost")) return true;
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  return v4 ? isPrivateIPv4(Number(v4[1]), Number(v4[2])) : false;
}

export function parseTarget(input: string, options: { ownHosts: readonly string[] }): TargetResult {
  if (input.length > MAX_URL_LENGTH) return { ok: false, code: "url_too_long" };
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, code: "invalid_url" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, code: "unsupported_scheme" };
  }
  if (url.username !== "" || url.password !== "") {
    return { ok: false, code: "credentials_not_allowed" };
  }
  if (url.hostname === "") return { ok: false, code: "invalid_url" };
  if (matches(url.hostname, options.ownHosts.map(normalizeOwnHost))) {
    return { ok: false, code: "own_host" };
  }
  if (isPrivateHost(url.hostname)) return { ok: false, code: "private_target" };
  if (matches(url.hostname, SHORTENER_HOSTS)) return { ok: false, code: "blocked_target" };
  if (url.href.length > MAX_URL_LENGTH) return { ok: false, code: "url_too_long" };
  const isIdn = url.hostname.split(".").some((label) => label.startsWith("xn--"));
  return { ok: true, url: url.href, host: url.hostname, isIdn };
}
