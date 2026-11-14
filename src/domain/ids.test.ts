import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import {
  ID_ALPHABET,
  ID_LENGTH,
  isReserved,
  LOOKUP_ID,
  parseCustomName,
  randomId,
  randomString,
} from "./ids.ts";

describe("randomId", () => {
  it("has 7 characters from the url-safe alphabet", () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 64, maxLength: 64 }), (bytes) => {
        const id = randomId((b) => {
          b.set(bytes.subarray(0, b.length));
          return b;
        });
        expect(id).toHaveLength(ID_LENGTH);
        expect([...id].every((c) => ID_ALPHABET.includes(c))).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("drops bytes at or above the unbiased limit (250 for 10 letters)", () => {
    const bytes = [255, 250, 251, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const fill = (b: Uint8Array) => {
      b.set(bytes);
      return b;
    };
    expect(randomString(7, "0123456789", fill)).toBe("0123456");
  });

  it("keeps drawing when a whole batch is rejected", () => {
    const batches = [Array(14).fill(255), [0, 1, 2, 3, 4, 5, 6, 0, 0, 0, 0, 0, 0, 0]];
    const fill = (b: Uint8Array) => {
      b.set(batches.shift() ?? []);
      return b;
    };
    expect(randomString(7, "ABCDEFGHIJ", fill)).toBe("ABCDEFG");
  });

  it("is unbiased: each letter of a 10-letter alphabet maps from the same number of accepted bytes", () => {
    const counts = new Map<string, number>();
    for (let byte = 0; byte < 250; byte++) {
      const out = randomString(1, "0123456789", (b) => b.fill(byte));
      counts.set(out, (counts.get(out) ?? 0) + 1);
    }
    expect(new Set(counts.values())).toEqual(new Set([25]));
  });

  it("never returns a reserved name: a reserved draw is discarded", () => {
    const batches = [
      [0, 1, 2, 0, 0, 0],
      [1, 0, 0, 0, 0, 0],
    ];
    const fill = (b: Uint8Array) => {
      b.set(batches.shift() ?? []);
      return b;
    };
    expect(isReserved("api")).toBe(true);
    expect(randomId(fill, "api", 3)).toBe("paa");
  });

  it("produces different ids", () => {
    expect(new Set(Array.from({ length: 50 }, () => randomId())).size).toBeGreaterThan(45);
  });
});

describe("parseCustomName", () => {
  it("accepts letters, digits, underscore and hyphen", () => {
    expect(parseCustomName("my-link_1")).toEqual({ ok: true, name: "my-link_1" });
  });

  it.each(["api", "stats", "docs", "history", "img", "favicon.ico"])(
    "rejects reserved name %s",
    (name) => {
      const res = parseCustomName(name);
      expect(res.ok).toBe(false);
    },
  );

  it("rejects an entry from public/ (img)", () => {
    expect(parseCustomName("img")).toEqual({ ok: false, code: "reserved_name" });
  });

  it("rejects a/b", () => {
    expect(parseCustomName("a/b")).toEqual({ ok: false, code: "invalid_name" });
  });

  it("rejects 2 characters (ab)", () => {
    expect(parseCustomName("ab")).toEqual({ ok: false, code: "invalid_name" });
  });

  it("rejects 33 characters and accepts 32", () => {
    expect(parseCustomName("a".repeat(33))).toEqual({ ok: false, code: "invalid_name" });
    expect(parseCustomName("a".repeat(32)).ok).toBe(true);
  });

  it("rejects 32 four-byte characters (over 96 UTF-8 bytes)", () => {
    // Mathematical bold letters are letters (\p{L}) of 4 UTF-8 bytes each.
    const name = "\u{1D400}".repeat(32);
    expect(parseCustomName(name)).toEqual({ ok: false, code: "name_too_long" });
  });

  it("accepts 24 four-byte characters (exactly 96 bytes)", () => {
    expect(parseCustomName("\u{1D400}".repeat(24)).ok).toBe(true);
  });

  it.each(["API", "Api", "\uff41\uff50\uff49", "Stats", "DOCS"])(
    "rejects look-alike of a reserved name: %p",
    (name) => {
      expect(parseCustomName(name)).toEqual({ ok: false, code: "reserved_name" });
    },
  );

  it.each(["\u0430pi", "p\u0430ypal", "\u03b1bc", "ab\u0441", "\u0531pi", "\u13a0pi", "\uab7api"])(
    "rejects a name that mixes scripts: %p",
    (name) => {
      expect(parseCustomName(name)).toEqual({ ok: false, code: "mixed_script" });
    },
  );

  it.each([
    "\u0141\u00f3d\u017a",
    "\u043f\u0440\u0438\u0432\u0435\u0442",
    "Caf\u00e9",
    "Name_1-x",
    "\u6771\u4eac\u90fd",
    "\u0531\u0532\u0533",
  ])("accepts %p and keeps it case sensitive", (name) => {
    expect(parseCustomName(name)).toEqual({ ok: true, name: name.normalize("NFC") });
  });

  it("names that differ only by case stay distinct", () => {
    expect(parseCustomName("Hello")).toEqual({ ok: true, name: "Hello" });
    expect(parseCustomName("hello")).toEqual({ ok: true, name: "hello" });
  });

  it("Cafe with accent in NFD and NFC gives the same name", () => {
    const nfc = parseCustomName("Café");
    const nfd = parseCustomName("Café");
    expect(nfc).toEqual(nfd);
    expect(nfc).toEqual({ ok: true, name: "Café" });
  });

  it("property: NFC and NFD forms are equivalent", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme", minLength: 0, maxLength: 40 }), (s) => {
        expect(parseCustomName(s.normalize("NFD"))).toEqual(parseCustomName(s.normalize("NFC")));
      }),
    );
  });

  it("property: an accepted name is NFC, 3-32 chars and at most 96 bytes", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme", maxLength: 40 }), (s) => {
        const res = parseCustomName(s);
        if (res.ok) {
          expect(res.name).toBe(res.name.normalize("NFC"));
          expect(new TextEncoder().encode(res.name).length).toBeLessThanOrEqual(96);
          expect(res.name).not.toContain("/");
        }
      }),
    );
  });
});

describe("LOOKUP_ID", () => {
  it("accepts imported v2 names with spaces and punctuation", () => {
    for (const id of ["abc", "a b", "hello!", "zółw", "x".repeat(64)]) {
      expect(LOOKUP_ID.test(id)).toBe(true);
    }
  });

  it("rejects /, control and format characters and more than 64 characters", () => {
    for (const id of [
      "",
      "a/b",
      "a\u0000b",
      "a\u007fb",
      "a\u200bb",
      "a\u202eb",
      "a\u00adb",
      "a\ufeffb",
      "x".repeat(65),
    ]) {
      expect(LOOKUP_ID.test(id)).toBe(false);
    }
  });
});
