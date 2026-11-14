import { describe, expect, test } from "bun:test";
import { type FieldTarget, pickTargets } from "./board.ts";

describe("pickTargets", () => {
  const targets = new Map<string, FieldTarget>([
    ["area:core", { fieldId: "A", optionId: "core" }],
    ["area:infra", { fieldId: "A", optionId: "infra" }],
    ["size:M", { fieldId: "S", optionId: "m" }],
  ]);

  test("picks the first label by sort order when several map to one field", () => {
    const picked = pickTargets(["area:infra", "size:M", "area:core", "type:chore"], targets);
    expect(picked).toEqual([
      ["area:core", { fieldId: "A", optionId: "core" }],
      ["size:M", { fieldId: "S", optionId: "m" }],
    ]);
  });

  test("does not depend on the input order", () => {
    expect(pickTargets(["area:core", "area:infra"], targets)).toEqual(
      pickTargets(["area:infra", "area:core"], targets),
    );
  });
});
