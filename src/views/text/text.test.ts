import { describe, expect, it } from "bun:test";
import { SHARED_TEXT } from "../../shared/text";
import { ENDPOINTS, ERROR_CODES, LIMIT_ROUTES, MIGRATION } from "./api";
import { PAGE_TEXT } from "./index";

/**
 * Lists every leaf of a dictionary as `path: kind`. Arrays count by index, so two dictionaries with
 * the same shape also have lists of the same length. JSX nodes are leaves: their inner markup is
 * free to differ between languages.
 */
function shape(value: unknown, path = ""): string[] {
  if (typeof value === "function") return [`${path}: function/${value.length}`];
  if (typeof value === "string") return [`${path}: ${value.trim() === "" ? "empty" : "string"}`];
  if (Array.isArray(value)) return value.flatMap((item, i) => shape(item, `${path}[${i}]`));
  if (value !== null && typeof value === "object") {
    // A rendered JSX node: hono/jsx nodes have a `tag` and a `props` object.
    if ("tag" in value && "props" in value) return [`${path}: jsx`];
    return Object.keys(value)
      .sort()
      .flatMap((key) => shape((value as Record<string, unknown>)[key], `${path}.${key}`));
  }
  return [`${path}: ${typeof value}`];
}

describe.each([
  ["page text", PAGE_TEXT],
  ["shared text", SHARED_TEXT],
] as const)("%s", (_, dictionaries) => {
  it("has the same keys, list lengths and kinds of value in pl and en", () => {
    expect(shape(dictionaries.en)).toEqual(shape(dictionaries.pl));
  });

  it("has no empty strings", () => {
    for (const lang of ["pl", "en"] as const) {
      expect(shape(dictionaries[lang]).filter((leaf) => leaf.endsWith(": empty"))).toEqual([]);
    }
  });
});

describe("API docs text", () => {
  it.each(["pl", "en"] as const)("lines up with the API constants in %s", (lang) => {
    const api = PAGE_TEXT[lang].api;
    expect(api.endpoints).toHaveLength(ENDPOINTS.length);
    ENDPOINTS.forEach((endpoint, i) => {
      expect(api.endpoints[i]?.responses).toHaveLength(endpoint.statuses.length);
    });
    expect(Object.keys(api.errorCodes).sort()).toEqual(ERROR_CODES.map((e) => e.code).sort());
    expect(api.limits).toHaveLength(LIMIT_ROUTES.length);
    expect(api.migration.rows).toHaveLength(MIGRATION.length);
  });
});

describe("text that must not be translated", () => {
  it("keeps the brand verb on the Polish button and a plain one in English", () => {
    expect(PAGE_TEXT.pl.home.submit).toBe("Dżajcuj");
    expect(PAGE_TEXT.en.home.submit).toBe("Shorten");
  });

  it("names a message for every form error in both languages", () => {
    expect(Object.keys(SHARED_TEXT.en.errors).sort()).toEqual(
      Object.keys(SHARED_TEXT.pl.errors).sort(),
    );
  });
});
