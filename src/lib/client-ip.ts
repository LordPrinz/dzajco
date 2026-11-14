const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const HEXTET = /^[0-9a-f]{1,4}$/i;
export const NO_IP = "noip";

/** The eight hextets of an IPv6 address, or null. An embedded IPv4 tail counts as two hextets. */
function expandIpv6(ip: string): string[] | null {
  let text = ip;
  const tail = /:(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (tail?.[1]) {
    if (!IPV4.test(tail[1])) return null;
    const [a, b, c, d] = tail[1].split(".").map(Number) as [number, number, number, number];
    text = `${text.slice(0, -tail[1].length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  if (!groups.every((g) => HEXTET.test(g))) return null;
  return groups.map((g) => Number.parseInt(g, 16).toString(16));
}

/**
 * Rate limit key for the client: `cf-connecting-ip`, with IPv6 cut to its /64 prefix so one
 * subscriber cannot rotate through addresses. `x-forwarded-for` is never read. A missing or
 * unparseable header gives the shared key `noip`, so such requests are limited together, not skipped.
 */
export function clientIpKey(request: Request): string {
  const ip = request.headers.get("cf-connecting-ip")?.trim();
  if (!ip) return NO_IP;
  if (IPV4.test(ip)) return ip;
  const groups = expandIpv6(ip);
  if (!groups) return NO_IP;
  if (groups.slice(0, 5).every((g) => g === "0") && groups[5] === "ffff") {
    const [hi, lo] = [Number.parseInt(groups[6] ?? "0", 16), Number.parseInt(groups[7] ?? "0", 16)];
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  return `${groups.slice(0, 4).join(":")}::/64`;
}
