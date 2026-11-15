import { describe, expect, it } from "bun:test";
import { isBot } from "./bots.ts";

describe("isBot", () => {
  it.each([
    "Googlebot/2.1 (+http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0)",
    "facebookexternalhit/1.1",
    "curl/8.4.0",
    "python-requests/2.31",
    "Go-http-client/2.0",
    "Slackbot-LinkExpanding 1.0",
    "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
    "Twitterbot/1.0",
    "SomeBot/1.0",
    "UptimeRobot/2.0",
  ])("treats %p as a bot", (ua) => {
    expect(isBot(ua)).toBe(true);
  });

  it.each([
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
  ])("treats browser %p as human", (ua) => {
    expect(isBot(ua)).toBe(false);
  });

  it("treats CUBOT phones as human", () => {
    expect(
      isBot(
        "Mozilla/5.0 (Linux; Android 12; CUBOT KINGKONG 5 Pro) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
      ),
    ).toBe(false);
  });

  it("an empty, blank or missing User-Agent counts as a bot", () => {
    expect(isBot("")).toBe(true);
    expect(isBot("   ")).toBe(true);
    expect(isBot(null)).toBe(true);
    expect(isBot(undefined)).toBe(true);
  });
});
