import { describe, expect, it } from "bun:test";
import * as v from "valibot";
import { bearerSchema, createLinkSchema, formBodySchema, keySchema } from "./schemas.ts";

const key = "A".repeat(22);

describe("keySchema and bearerSchema", () => {
  it("accepts a 22 char base64url key", () => {
    expect(v.safeParse(keySchema, "abcDEF012-_abcDEF012-_").success).toBe(true);
  });

  it('{"$ne":null} as key is a schema error', () => {
    expect(v.safeParse(keySchema, { $ne: null }).success).toBe(false);
    expect(v.safeParse(bearerSchema, { $ne: null }).success).toBe(false);
  });

  it.each([
    "",
    "short",
    "A".repeat(21),
    "A".repeat(23),
    `${"A".repeat(21)}=`,
    `${"A".repeat(21)}+`,
  ])("rejects key %p", (bad) => {
    expect(v.safeParse(keySchema, bad).success).toBe(false);
  });

  it("bearerSchema extracts the key", () => {
    expect(v.parse(bearerSchema, `Bearer ${key}`)).toBe(key);
  });

  it("bearerSchema accepts the scheme in any case", () => {
    for (const scheme of ["bearer", "BEARER", "BeArEr"]) {
      expect(v.parse(bearerSchema, `${scheme} ${key}`)).toBe(key);
    }
  });

  it.each([key, `Bearer  ${key}`, "Bearer short", `Basic ${key}`])(
    "bearerSchema rejects %p",
    (bad) => {
      expect(v.safeParse(bearerSchema, bad).success).toBe(false);
    },
  );
});

describe("createLinkSchema", () => {
  it("accepts url only", () => {
    expect(v.safeParse(createLinkSchema, { url: "https://a.com" }).success).toBe(true);
  });

  it("accepts customName and expiresAt null", () => {
    const res = v.safeParse(createLinkSchema, {
      url: "https://a.com",
      customName: "abc",
      expiresAt: null,
    });
    expect(res.success).toBe(true);
  });

  it("rejects unknown keys", () => {
    expect(v.safeParse(createLinkSchema, { url: "https://a.com", secretKey: "x" }).success).toBe(
      false,
    );
  });

  it('{"$ne":null} in any string field is a schema error', () => {
    for (const field of ["url", "customName", "expiresAt"]) {
      const body = { url: "https://a.com", [field]: { $ne: null } };
      expect(v.safeParse(createLinkSchema, body).success).toBe(false);
    }
  });

  it("rejects an over-long url (2049) and customName (129), accepts the limits", () => {
    expect(v.safeParse(createLinkSchema, { url: "a".repeat(2049) }).success).toBe(false);
    expect(v.safeParse(createLinkSchema, { url: "a".repeat(2048) }).success).toBe(true);
    expect(v.safeParse(createLinkSchema, { url: "a", customName: "a".repeat(129) }).success).toBe(
      false,
    );
    expect(v.safeParse(createLinkSchema, { url: "a", customName: "a".repeat(128) }).success).toBe(
      true,
    );
    expect(v.safeParse(formBodySchema, { url: "a", customName: "a".repeat(129) }).success).toBe(
      false,
    );
  });

  it("rejects a missing or non-string url, and non-objects", () => {
    expect(v.safeParse(createLinkSchema, {}).success).toBe(false);
    expect(v.safeParse(createLinkSchema, { url: 1 }).success).toBe(false);
    expect(v.safeParse(createLinkSchema, null).success).toBe(false);
    expect(v.safeParse(createLinkSchema, []).success).toBe(false);
  });
});

describe("formBodySchema", () => {
  it("turns empty fields into not set", () => {
    expect(
      v.parse(formBodySchema, { url: "https://a.com", customName: "", expiresAt: "" }),
    ).toEqual({ url: "https://a.com", customName: undefined, expiresAt: null });
  });

  it("keeps filled fields and rejects unknown keys", () => {
    expect(
      v.parse(formBodySchema, {
        url: "https://a.com",
        customName: "abc",
        expiresAt: "2026-01-01T00:00Z",
      }),
    ).toEqual({ url: "https://a.com", customName: "abc", expiresAt: "2026-01-01T00:00Z" });
    expect(v.safeParse(formBodySchema, { url: "https://a.com", x: "1" }).success).toBe(false);
  });
});
