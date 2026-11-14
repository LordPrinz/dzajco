import { describe, expect, test } from "bun:test";
import { hasClosingKeyword, withClosingKeyword } from "./closing-keyword.ts";

describe("hasClosingKeyword", () => {
  test.each([
    "Closes #12",
    "closes: #12",
    "Fixes #12.",
    "resolved #12",
    "closes acme/app#12",
    "Closes: acme/app#12",
    "intro\n\nFixed #12\n",
  ])("recognises %p", (body) => {
    expect(hasClosingKeyword(body, "12")).toBe(true);
  });

  test.each(["", "Closes #123", "Closes #1", "See #12", "Closes #", "Closes acme/app#123"])(
    "does not recognise %p",
    (body) => {
      expect(hasClosingKeyword(body, "12")).toBe(false);
    },
  );
});

describe("withClosingKeyword", () => {
  test("fills the empty template line", () => {
    expect(withClosingKeyword("Intro\n\nCloses #\n", "12")).toBe("Intro\n\nCloses #12");
  });

  test("appends a line otherwise", () => {
    expect(withClosingKeyword("Intro", "12")).toBe("Intro\n\nCloses #12");
    expect(withClosingKeyword("", "12")).toBe("Closes #12");
  });
});
