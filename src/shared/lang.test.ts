import { describe, expect, it } from "bun:test";
import { langFromAcceptLanguage, parseLang, resolveLang } from "./lang";

describe("parseLang", () => {
  it.each([
    ["pl", "pl"],
    ["EN", "en"],
    [" en ", "en"],
  ] as const)("reads %p as %s", (value, lang) => {
    expect(parseLang(value)).toBe(lang);
  });

  it.each([undefined, null, "", "de", "pl-PL", "english"])("rejects %p", (value) => {
    expect(parseLang(value)).toBeNull();
  });
});

describe("langFromAcceptLanguage", () => {
  it.each([
    ["pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7", "pl"],
    ["en-US,en;q=0.9,pl;q=0.8", "en"],
    ["de-DE,de;q=0.9,pl;q=0.5,en;q=0.4", "pl"],
    ["de,en;q=0.5,pl;q=0.8", "pl"],
    ["fr, en, pl", "en"],
    ["en;q=0, pl;q=0.1", "pl"],
    ["PL", "pl"],
  ] as const)("%s -> %s", (header, lang) => {
    expect(langFromAcceptLanguage(header)).toBe(lang);
  });

  it.each([undefined, null, "", "de-DE,fr;q=0.8", "*", "en;q=0", "pl;q=abc"])(
    "%p has no supported language",
    (header) => {
      expect(langFromAcceptLanguage(header)).toBeNull();
    },
  );
});

describe("resolveLang", () => {
  it("prefers the URL's ?lang= over everything else", () => {
    expect(resolveLang({ query: "en", cookie: "pl", country: "PL", acceptLanguage: "pl" })).toBe(
      "en",
    );
  });

  it("prefers the visitor's cookie over the country and the browser", () => {
    expect(resolveLang({ cookie: "en", country: "PL", acceptLanguage: "pl" })).toBe("en");
    expect(resolveLang({ cookie: "pl", country: "US", acceptLanguage: "en-US" })).toBe("pl");
  });

  it("gives Polish to visitors in Poland whatever their browser says", () => {
    expect(resolveLang({ country: "PL", acceptLanguage: "en-US" })).toBe("pl");
    expect(resolveLang({ country: "pl" })).toBe("pl");
  });

  it("falls back to Accept-Language outside Poland", () => {
    expect(resolveLang({ country: "DE", acceptLanguage: "pl-PL,de;q=0.5" })).toBe("pl");
    expect(resolveLang({ country: "GB", acceptLanguage: "en-GB" })).toBe("en");
  });

  it("ends with English", () => {
    expect(resolveLang({})).toBe("en");
    expect(resolveLang({ country: "DE", acceptLanguage: "de-DE" })).toBe("en");
  });

  it("skips values it does not know instead of failing", () => {
    expect(resolveLang({ query: "de", cookie: "xx", country: "PL" })).toBe("pl");
  });
});
