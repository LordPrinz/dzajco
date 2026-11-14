import { describe, expect, it, spyOn } from "bun:test";
import {
  currentVersion,
  generateSecretKey,
  hashSecret,
  peppersFromEnv,
  verifySecret,
} from "./secret";

const peppers = { 1: "pepper-one", 2: "pepper-two" };

describe("generateSecretKey", () => {
  it("is 22 chars of unpadded base64url", () => {
    expect(generateSecretKey()).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("is unique across 1000 keys", () => {
    const keys = new Set(Array.from({ length: 1000 }, generateSecretKey));
    expect(keys.size).toBe(1000);
  });
});

describe("hashSecret", () => {
  it("formats as v1:<64 hex>", async () => {
    expect(await hashSecret("k", { version: 1, peppers })).toMatch(/^v1:[0-9a-f]{64}$/);
  });

  // printf %s k | openssl dgst -sha256 -hmac pepper-one
  it("matches the openssl HMAC-SHA256 known answer (key=k, pepper=pepper-one)", async () => {
    expect(await hashSecret("k", { version: 1, peppers: { 1: "pepper-one" } })).toBe(
      "v1:c2aa99e7d6e4e5ccbc288c2d5ea4621457e5da227b168fe4a1c9aa798e8e6e12",
    );
  });

  it("is deterministic for the same key and pepper", async () => {
    const a = await hashSecret("k", { version: 1, peppers });
    const b = await hashSecret("k", { version: 1, peppers });
    expect(a).toBe(b);
  });

  it("differs with a different pepper", async () => {
    const a = await hashSecret("k", { version: 1, peppers: { 1: "a" } });
    const b = await hashSecret("k", { version: 1, peppers: { 1: "b" } });
    expect(a.slice(3)).not.toBe(b.slice(3));
  });

  it("throws when the pepper is missing or empty", async () => {
    await expect(hashSecret("k", { version: 3, peppers })).rejects.toThrow(/version 3/);
    await expect(hashSecret("k", { version: 1, peppers: { 1: "" } })).rejects.toThrow(/version 1/);
  });
});

describe("verifySecret", () => {
  it("accepts the right key", async () => {
    const key = generateSecretKey();
    const stored = await hashSecret(key, { version: 1, peppers });
    expect(await verifySecret(key, stored, peppers)).toBe(true);
  });

  it("survives pepper rotation", async () => {
    const env = { SECRET_PEPPER_VERSION: "1", SECRET_PEPPER_V1: "p1" };
    const oldHash = await hashSecret("k", {
      version: currentVersion(env),
      peppers: peppersFromEnv(env),
    });
    const rotated = { SECRET_PEPPER_VERSION: "2", SECRET_PEPPER_V1: "p1", SECRET_PEPPER_V2: "p2" };
    const rotatedPeppers = peppersFromEnv(rotated);
    expect(await verifySecret("k", oldHash, rotatedPeppers)).toBe(true);
    const fresh = await hashSecret("k", {
      version: currentVersion(rotated),
      peppers: rotatedPeppers,
    });
    expect(fresh.startsWith("v2:")).toBe(true);
    expect(await verifySecret("k", fresh, rotatedPeppers)).toBe(true);
  });

  it("rejects wrong key, tampered hash and unknown version", async () => {
    const stored = await hashSecret("k", { version: 1, peppers });
    expect(await verifySecret("other", stored, peppers)).toBe(false);
    const last = stored.endsWith("0") ? "1" : "0";
    expect(await verifySecret("k", stored.slice(0, -1) + last, peppers)).toBe(false);
    expect(await verifySecret("k", stored.replace("v1:", "v9:"), peppers)).toBe(false);
  });

  it("returns false for garbage stored values without throwing", async () => {
    for (const bad of [
      "",
      "v1:",
      "v9:xx",
      '{"$ne":null}',
      `v1:${"A".repeat(64)}`,
      `1:${"a".repeat(64)}`,
    ]) {
      expect(await verifySecret("k", bad, peppers)).toBe(false);
    }
  });

  it("returns false for different-length keys and short digests", async () => {
    const stored = await hashSecret("k", { version: 1, peppers });
    expect(await verifySecret("k".repeat(500), stored, peppers)).toBe(false);
    expect(await verifySecret("", stored, peppers)).toBe(false);
    expect(await verifySecret("k", stored.slice(0, -2), peppers)).toBe(false);
  });
});

describe("missing pepper warning", () => {
  it("warns once per version and still returns false", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const stored = `v77:${"a".repeat(64)}`;
    expect(await verifySecret("k", stored, peppers)).toBe(false);
    expect(await verifySecret("k", stored, peppers)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("secret pepper v77 missing");
    warn.mockRestore();
  });
});

describe("env helpers", () => {
  it("peppersFromEnv reads SECRET_PEPPER_V<n> and skips empty or unrelated values", () => {
    expect(
      peppersFromEnv({
        SECRET_PEPPER_V1: "a",
        SECRET_PEPPER_V2: "",
        SECRET_PEPPER_VX: "z",
        OTHER: "q",
      }),
    ).toEqual({ 1: "a" });
  });

  it("currentVersion rejects invalid values", () => {
    expect(() => currentVersion({})).toThrow();
    expect(() => currentVersion({ SECRET_PEPPER_VERSION: "0" })).toThrow();
    expect(currentVersion({ SECRET_PEPPER_VERSION: "3" })).toBe(3);
  });
});
