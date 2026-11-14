import { describe, expect, test } from "bun:test";
import { createApplier, createGraphql, createRest, isIssueClosed, isSubset } from "./github.ts";

const answering = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("isIssueClosed", () => {
  test("is true for a closed issue", async () => {
    expect(await isIssueClosed("t", "acme", "app", 74, answering(200, { state: "closed" }))).toBe(
      true,
    );
  });

  test("is false for an open issue", async () => {
    expect(await isIssueClosed("t", "acme", "app", 74, answering(200, { state: "open" }))).toBe(
      false,
    );
  });

  test("asks for the right issue with the token", async () => {
    const calls: { url: string; auth: string | null }[] = [];
    const spy = (async (url: string, init?: RequestInit) => {
      calls.push({ url, auth: new Headers(init?.headers).get("authorization") });
      return new Response(JSON.stringify({ state: "open" }));
    }) as unknown as typeof fetch;
    await isIssueClosed("tok", "acme", "app", 74, spy);
    expect(calls).toEqual([
      { url: "https://api.github.com/repos/acme/app/issues/74", auth: "Bearer tok" },
    ]);
  });

  test("fails loudly when GitHub refuses, instead of treating it as open", async () => {
    await expect(isIssueClosed("t", "acme", "app", 74, answering(403, {}))).rejects.toThrow(
      "Failed to read issue #74: 403",
    );
  });
});

describe("isSubset", () => {
  test("accepts extra keys and any array order, rejects differences", () => {
    expect(
      isSubset(
        { a: 1, b: [{ t: "x" }, { t: "y" }] },
        { a: 1, c: 2, b: [{ t: "y", z: 1 }, { t: "x" }] },
      ),
    ).toBe(true);
    expect(isSubset({ a: 1 }, { a: 2 })).toBe(false);
    expect(isSubset({ b: [1] }, { b: [1, 2] })).toBe(false);
    expect(isSubset({ a: { b: 1 } }, { a: null })).toBe(false);
  });
});

describe("createRest", () => {
  test("sends a body through stdin and spells the method out", async () => {
    const seen: { args: string[]; stdin?: string }[] = [];
    const rest = createRest(async (args, stdin) => {
      seen.push({ args, stdin });
      return { code: 0, stdout: "" };
    }, "acme/app");
    await rest.write("PUT", "/topics", { names: ["a"] });
    expect(seen).toEqual([
      {
        args: ["api", "-X", "PUT", "repos/acme/app/topics", "--input", "-"],
        stdin: '{"names":["a"]}',
      },
    ]);
  });

  test("exists reflects the exit code", async () => {
    const rest = (code: number) => createRest(async () => ({ code, stdout: "" }), "acme/app");
    expect(await rest(0).exists("/x")).toBe(true);
    expect(await rest(1).exists("/x")).toBe(false);
  });
});

describe("createGraphql", () => {
  test("refuses a mutation when read-only, before any network call", async () => {
    const graphql = createGraphql("t", { readOnly: true });
    await expect(graphql("mutation { x }")).rejects.toThrow("dry run");
  });
});

describe("createApplier", () => {
  test("in a dry run it reports and never calls the write", async () => {
    const out: string[] = [];
    const apply = createApplier(true, (l) => out.push(l));
    let wrote = false;
    await apply.change("thing", async () => {
      wrote = true;
    });
    apply.unchanged("other");
    expect(wrote).toBe(false);
    expect(out).toEqual(["would change: thing", "unchanged: other"]);
  });
});
