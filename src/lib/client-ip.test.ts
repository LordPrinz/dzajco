import { describe, expect, it } from "bun:test";
import { clientIpKey, NO_IP } from "./client-ip.ts";

function req(ip?: string, extra: Record<string, string> = {}): Request {
  const headers = new Headers(extra);
  if (ip !== undefined) headers.set("cf-connecting-ip", ip);
  return new Request("http://localhost/x", { headers });
}

describe("clientIpKey", () => {
  it("returns an IPv4 address as is", () => {
    expect(clientIpKey(req("203.0.113.7"))).toBe("203.0.113.7");
  });

  it("cuts an IPv6 address to its /64 prefix", () => {
    expect(clientIpKey(req("2001:db8:1:2:3:4:5:6"))).toBe("2001:db8:1:2::/64");
  });

  it("gives every address of one /64 the same key", () => {
    expect(clientIpKey(req("2001:db8:a:b::1"))).toBe(clientIpKey(req("2001:db8:a:b:ffff::9")));
  });

  it("expands :: before cutting", () => {
    expect(clientIpKey(req("2001:db8::1"))).toBe("2001:db8:0:0::/64");
    expect(clientIpKey(req("::1"))).toBe("0:0:0:0::/64");
  });

  it("normalises case and leading zeros", () => {
    expect(clientIpKey(req("2001:0DB8:000A:00b0::1"))).toBe("2001:db8:a:b0::/64");
  });

  it("returns the IPv4 address of an IPv4-mapped IPv6 address", () => {
    expect(clientIpKey(req("::ffff:198.51.100.4"))).toBe("198.51.100.4");
  });

  it("ignores x-forwarded-for", () => {
    expect(clientIpKey(req(undefined, { "x-forwarded-for": "198.51.100.4" }))).toBe(NO_IP);
    expect(clientIpKey(req("203.0.113.7", { "x-forwarded-for": "198.51.100.4" }))).toBe(
      "203.0.113.7",
    );
  });

  it("returns the shared noip key for a missing or malformed header", () => {
    expect(NO_IP).toBe("noip");
    expect(clientIpKey(req())).toBe(NO_IP);
    expect(clientIpKey(req(""))).toBe(NO_IP);
    expect(clientIpKey(req("not an ip"))).toBe(NO_IP);
    expect(clientIpKey(req("1:2:3:4:5:6:7:8:9"))).toBe(NO_IP);
    expect(clientIpKey(req("1::2::3"))).toBe(NO_IP);
  });
});
