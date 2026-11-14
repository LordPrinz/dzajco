import { describe, expect, it } from "bun:test";
import { reportAbuseLink } from "./abuse";

describe("reportAbuseLink", () => {
  it("is null when unset or empty", () => {
    expect(reportAbuseLink({})).toBeNull();
    expect(reportAbuseLink({ ABUSE_EMAIL: "" })).toBeNull();
  });
  it("is null for a value that is not a plain address", () => {
    expect(reportAbuseLink({ ABUSE_EMAIL: 'a@b.c?cc=x"' })).toBeNull();
    expect(reportAbuseLink({ ABUSE_EMAIL: "not an email" })).toBeNull();
    for (const bad of ["a@b.c?x=1", "a&b@c.d", "a%40@c.d", "a@b#c.d", "a=b@c.d"]) {
      expect(reportAbuseLink({ ABUSE_EMAIL: bad })).toBeNull();
    }
  });
  it("builds a mailto with the link id in the subject", () => {
    expect(reportAbuseLink({ ABUSE_EMAIL: "abuse@dzaj.co" }, { linkId: "abc" })).toBe(
      "mailto:abuse@dzaj.co?subject=Report%20abuse%3A%20link%20abc",
    );
  });
  it("encodes special characters in the id", () => {
    const href = reportAbuseLink({ ABUSE_EMAIL: "a@b.co" }, { linkId: 'x"&<>?#\n' });
    expect(href).not.toMatch(/["<>\n#]/);
    expect(href).toContain("%22%26%3C%3E%3F%23%0A");
  });
});
