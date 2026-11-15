import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import {
  hostSuffixes,
  isPrivateHost,
  MAX_URL_LENGTH,
  parseTarget,
  SHORTENER_HOSTS,
} from "./url-policy.ts";

const ownHosts = ["dzaj.co"];
const parse = (input: string) => parseTarget(input, { ownHosts });

describe("parseTarget", () => {
  it("accepts http and https and returns the normalized url", () => {
    expect(parse("https://example.com/a?b=1#c")).toEqual({
      ok: true,
      url: "https://example.com/a?b=1#c",
      host: "example.com",
      isIdn: false,
    });
    expect(parse("http://example.com").ok).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "ftp://example.com/file",
    "vbscript:msgbox(1)",
    "blob:https://example.com/uuid",
    "mailto:a@b.c",
    "ws://example.com",
  ])("rejects scheme in %p", (input) => {
    expect(parse(input)).toEqual({ ok: false, code: "unsupported_scheme" });
  });

  it("rejects scheme tricks (case, whitespace, control chars)", () => {
    expect(parse(" JaVaScRiPt:alert(1)").ok).toBe(false);
    expect(parse("java\nscript:alert(1)").ok).toBe(false);
  });

  it("rejects garbage and relative urls", () => {
    expect(parse("not a url")).toEqual({ ok: false, code: "invalid_url" });
    expect(parse("/relative")).toEqual({ ok: false, code: "invalid_url" });
    expect(parse("")).toEqual({ ok: false, code: "invalid_url" });
  });

  it("rejects more than 2048 characters and accepts exactly 2048", () => {
    const base = "https://example.com/";
    expect(parse(base + "a".repeat(MAX_URL_LENGTH - base.length + 1))).toEqual({
      ok: false,
      code: "url_too_long",
    });
    expect(parse(base + "a".repeat(MAX_URL_LENGTH - base.length)).ok).toBe(true);
  });

  it("rejects a url that grows past 2048 characters after normalization", () => {
    const path = "ż".repeat(1000);
    expect(parse(`https://example.com/${path}`)).toEqual({ ok: false, code: "url_too_long" });
  });

  it("converts an IDN host to punycode", () => {
    const res = parse("https://żółw.pl");
    expect(res).toEqual({
      ok: true,
      url: "https://xn--w-uga1v8h.pl/",
      host: "xn--w-uga1v8h.pl",
      isIdn: true,
    });
  });

  it("rejects the own host, its subdomains and other cases", () => {
    for (const input of [
      "https://dzaj.co/abc",
      "https://DZAJ.CO",
      "https://www.dzaj.co",
      "https://a.b.dzaj.co:8443/x",
      "https://dzaj.co./",
      "https://dzaj.co../",
    ]) {
      expect(parse(input)).toEqual({ ok: false, code: "own_host" });
    }
  });

  it("does not treat a lookalike as the own host", () => {
    expect(parse("https://notdzaj.co").ok).toBe(true);
    expect(parse("https://dzaj.co.evil.com").ok).toBe(true);
  });

  it("rejects credentials in the url", () => {
    expect(parse("https://user:pass@example.com")).toEqual({
      ok: false,
      code: "credentials_not_allowed",
    });
    expect(parse("https://user@example.com").ok).toBe(false);
  });

  it.each(SHORTENER_HOSTS)(
    "rejects the shortener %s and its subdomains as blocked_target",
    (host) => {
      expect(parse(`https://${host}/x`)).toEqual({ ok: false, code: "blocked_target" });
      expect(parse(`https://www.${host}/x`)).toEqual({ ok: false, code: "blocked_target" });
    },
  );

  it("property: the scheme of an accepted url is http or https", () => {
    fc.assert(
      fc.property(fc.webUrl(), (s) => {
        const res = parse(s);
        if (res.ok) expect(["http:", "https:"]).toContain(new URL(res.url).protocol);
      }),
      { numRuns: 500 },
    );
  });

  it("property: parseTarget never accepts a non-http(s) scheme", () => {
    const scheme = fc
      .stringMatching(/^[a-z][a-z0-9+.-]{0,10}$/)
      .filter((s) => s !== "http" && s !== "https");
    fc.assert(
      fc.property(fc.webUrl(), scheme, (u, s) => {
        expect(parse(u.replace(/^https?:/, `${s}:`)).ok).toBe(false);
      }),
    );
  });

  it("property: web urls on public hosts are accepted with an http(s) scheme", () => {
    fc.assert(
      fc.property(fc.webUrl(), (u) => {
        const res = parse(u);
        if (res.ok) expect(["http:", "https:"]).toContain(new URL(res.url).protocol);
      }),
    );
  });

  it("property: accepted urls are within 2048 characters", () => {
    fc.assert(
      fc.property(fc.webUrl({ size: "large" }), (u) => {
        const res = parse(u);
        if (res.ok) expect(res.url.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
      }),
    );
  });
});

describe("own hosts normalization", () => {
  it("ignores case, trailing dots and ports in the configured hosts", () => {
    for (const own of ["dzaj.co.", "DZAJ.CO", "dzaj.co:443", "dzaj.co.."]) {
      expect(parseTarget("https://dzaj.co/x", { ownHosts: [own] })).toEqual({
        ok: false,
        code: "own_host",
      });
    }
  });
});

describe("private targets", () => {
  it.each([
    "http://localhost/",
    "http://foo.localhost/",
    "http://LOCALHOST./",
    "http://127.0.0.1/",
    "http://127.255.255.254/",
    "http://10.0.0.1/",
    "http://172.16.0.1/",
    "http://172.31.255.255/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data",
    "http://0.0.0.0/",
    "http://0.1.2.3/",
    "http://100.64.0.1/",
    "http://100.127.255.255/",
    "http://0x7f.1/",
    "http://2130706433/",
    "http://017700000001/",
    "http://127.1/",
    "http://[::1]/",
    "http://[::]/",
    "http://[fc00::1]/",
    "http://[fd12:3456::1]/",
    "http://[fe80::1]/",
    "http://[febf::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:10.0.0.1]/",
    "http://[::ffff:c0a8:1]/",
    "http://[64:ff9b::7f00:1]/",
    "http://[::7f00:1]/",
    "http://224.0.0.1/",
    "http://239.255.255.255/",
    "http://240.0.0.1/",
    "http://255.255.255.255/",
    "http://[2002:c000:204::1]/",
    "http://192.0.0.1/",
    "http://192.0.2.1/",
    "http://198.18.0.1/",
    "http://198.19.255.255/",
    "http://198.51.100.7/",
    "http://203.0.113.5/",
    "http://[::ffff:198.18.0.1]/",
    "http://[ff02::1]/",
    "http://[ff0e::1]/",
    "http://[fec0::1]/",
    "http://[feff::1]/",
    "http://[2001:db8::1]/",
    "http://[2001:db8:ffff::1]/",
    "http://[2001:0:4136:e378:8000:63bf:f5ff:fffe]/",
    "http://[2001::1]/",
    "http://[100::1]/",
    "http://[100::ffff:ffff:ffff:ffff]/",
    "http://[64:ff9b:1::1]/",
    "http://[64:ff9b:1:ffff::808:808]/",
    "http://[::ffff:0:a00:1]/",
    "http://[::ffff:0:7f00:1]/",
    "http://[3fff::1]/",
    "http://[3fff:fff:ffff::1]/",
    "http://[::1:a00:1]/",
    "http://[::2:0:0:1]/",
    "http://[0:0:1::1]/",
    "http://[100:0:0:1::1]/",
    "http://[100:1::1]/",
    "http://[100:ffff::1]/",
    "http://[2001:2::1]/",
    "http://[2001:2:0:ffff::1]/",
    "http://[2001:10::1]/",
    "http://[2001:1f::1]/",
    "http://[2001:20::1]/",
    "http://[2001:2f::1]/",
    "http://[5f00::1]/",
    "http://[5f00:ffff::1]/",
    "http://metadata/",
    "http://notlocalhost/",
    "http://metadata./",
    "https://intranet:8080/x",
    "http://localhost./",
    "http://192.88.99.1/",
    "http://192.88.99.255/",
    "http://[::ffff:1.2.3.4]/",
    "http://[::ffff:8.8.8.8]/",
    "http://[::1.2.3.4]/",
    "http://[64:ff9b::1.2.3.4]/",
    "http://[64:ff9b::808:808]/",
    "http://[::ffff:0:808:808]/",
  ])("rejects %s as private_target", (input) => {
    expect(parse(input)).toEqual({ ok: false, code: "private_target" });
  });

  it.each([
    "http://8.8.8.8/",
    "http://223.255.255.255/",
    "http://[2003::1]/",
    "http://172.15.0.1/",
    "http://172.32.0.1/",
    "http://100.63.0.1/",
    "http://100.128.0.1/",
    "http://169.253.0.1/",
    "http://192.169.0.1/",
    "http://[2606:4700:4700::1111]/",
    "http://[2001:4860:4860::8888]/",
    "http://[2001:1::1]/",
    "http://[2001:db9::1]/",
    "http://[fe00::1]/",
    "http://[1::1]/",
    "http://[101::1]/",
    "http://[2a00:1450::1]/",
    "http://[2001:2:1::1]/",
    "http://[2001:3::1]/",
    "http://[2001:f::1]/",
    "http://[2001:30::1]/",
    "http://[5eff::1]/",
    "http://[5f01::1]/",
    "http://example.com./",
    "http://[64:ff9b:2::1]/",
    "http://[3fff:1000::1]/",
    "http://[3ffe::1]/",
    "http://192.0.1.1/",
    "http://192.88.98.1/",
    "http://192.88.100.1/",
    "http://192.0.3.1/",
    "http://198.17.255.255/",
    "http://198.20.0.1/",
    "http://198.51.101.1/",
    "http://203.0.112.1/",
    "http://203.0.114.1/",
    "http://localhost.example.com/",
  ])("accepts public %s", (input) => {
    expect(parse(input).ok).toBe(true);
  });

  it("rejects a host longer than 253 characters as invalid_url", () => {
    expect(parse(`http://${"a.".repeat(900)}com/`)).toEqual({ ok: false, code: "invalid_url" });
    expect(
      parse(`http://${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(57)}.com/`)
        .ok,
    ).toBe(true);
    expect(
      parse(`http://${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(58)}.com/`),
    ).toEqual({
      ok: false,
      code: "invalid_url",
    });
  });

  it("rejects a malformed IPv6 group layout safely", () => {
    expect(isPrivateHost("[1::2::3]")).toBe(true);
    expect(isPrivateHost("[1:2:3]")).toBe(true);
    expect(isPrivateHost("[1:2:3:4:5:6:7:8:9]")).toBe(true);
    expect(isPrivateHost("[1:2:3:4:5:6:7::8]")).toBe(true);
  });
});

describe("hostSuffixes", () => {
  it("lists the host and its parent domains, longest first", () => {
    expect(hostSuffixes("a.b.example.com")).toEqual([
      "a.b.example.com",
      "b.example.com",
      "example.com",
      "com",
    ]);
  });

  it("lowercases and drops trailing dots", () => {
    expect(hostSuffixes("Example.COM..")).toEqual(["example.com", "com"]);
  });
});
