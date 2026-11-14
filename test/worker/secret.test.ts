import { expect, it } from "vitest";
import { generateSecretKey, hashSecret, verifySecret } from "../../src/domain/secret";

it("hashes and verifies inside workerd", async () => {
  const peppers = { 1: "worker-pepper" };
  const key = generateSecretKey();
  const stored = await hashSecret(key, { version: 1, peppers });
  expect(stored).toMatch(/^v1:[0-9a-f]{64}$/);
  expect(await verifySecret(key, stored, peppers)).toBe(true);
  expect(await verifySecret("wrong", stored, peppers)).toBe(false);
  expect(await verifySecret(key, "garbage", peppers)).toBe(false);
});
