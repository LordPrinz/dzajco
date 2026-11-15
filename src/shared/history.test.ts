import { describe, expect, it } from "bun:test";
import {
  addOutcome,
  buildDeleteRequest,
  canDelete,
  deleteOutcome,
  entryFromLink,
  isExpired,
  MAX_RENDERED,
  newestFirst,
  parseHistory,
  removeEntry,
  shortUrl,
  statsPath,
  upsertEntry,
  visibleEntries,
  withKey,
} from "./history";

// What v2 and the v3 form write to localStorage: createdAt is a Date serialised to ISO.
const V2_FIXTURE = JSON.stringify([
  {
    id: "abcd",
    url: "https://example.com/one",
    expire: "never",
    createdAt: "2023-09-07T10:00:00.000Z",
    secretKey: "k-owner-1",
  },
  {
    id: "moje-linki",
    url: "https://example.org/two",
    expire: "2099-01-01T00:00:00.000Z",
    createdAt: "2024-01-02T10:00:00.000Z",
  },
  {
    id: "stary",
    url: "https://example.net/three",
    expire: "2020-01-01T00:00:00.000Z",
    createdAt: "2019-12-01T10:00:00.000Z",
    secretKey: "k-owner-3",
  },
]);

describe("parseHistory", () => {
  it("reads a v2 history", () => {
    const entries = parseHistory(V2_FIXTURE);
    expect(entries.map((e) => e.id)).toEqual(["abcd", "moje-linki", "stary"]);
    expect(entries[0]?.secretKey).toBe("k-owner-1");
    expect(entries[1]?.secretKey).toBeUndefined();
  });

  it("returns an empty list for missing, broken or non-array values", () => {
    expect(parseHistory(null)).toEqual([]);
    expect(parseHistory("")).toEqual([]);
    expect(parseHistory("{not json")).toEqual([]);
    expect(parseHistory('{"id":"a"}')).toEqual([]);
    expect(parseHistory("null")).toEqual([]);
  });

  it("drops entries without a usable id or url and fills missing optional fields", () => {
    const raw = JSON.stringify([
      null,
      "text",
      { id: "", url: "https://a.example" },
      { id: "x" },
      { id: 5, url: "https://a.example" },
      { id: "ok", url: "https://a.example", secretKey: "" },
    ]);
    expect(parseHistory(raw)).toEqual([
      { id: "ok", url: "https://a.example", expire: "never", createdAt: "" },
    ]);
  });

  it("never trusts a non-string secretKey (v2 bug class: objects as keys)", () => {
    const raw = JSON.stringify([{ id: "a", url: "https://a.example", secretKey: { $ne: null } }]);
    expect(parseHistory(raw)[0]?.secretKey).toBeUndefined();
  });
});

describe("expiry and order", () => {
  const now = Date.parse("2026-01-01T00:00:00Z");
  const [forever, future, past] = parseHistory(V2_FIXTURE);

  it("tells expired entries apart", () => {
    expect(forever && isExpired(forever, now)).toBe(false);
    expect(future && isExpired(future, now)).toBe(false);
    expect(past && isExpired(past, now)).toBe(true);
    expect(isExpired({ id: "a", url: "u", expire: "garbage", createdAt: "" }, now)).toBe(false);
  });

  it("sorts newest first", () => {
    expect(newestFirst(parseHistory(V2_FIXTURE)).map((e) => e.id)).toEqual([
      "moje-linki",
      "abcd",
      "stary",
    ]);
  });
});

describe("deleting", () => {
  const [owned, readOnly] = parseHistory(V2_FIXTURE);

  it("allows delete only for entries with a secretKey", () => {
    expect(owned && canDelete(owned)).toBe(true);
    expect(readOnly && canDelete(readOnly)).toBe(false);
  });

  it("builds a Bearer DELETE with the key in the header and never in the URL", () => {
    const request = owned && buildDeleteRequest(owned);
    expect(request).toEqual({
      path: "/api/v1/links/abcd",
      init: { method: "DELETE", headers: { Authorization: "Bearer k-owner-1" } },
    });
    expect(request?.path).not.toContain("k-owner-1");
    expect(readOnly && buildDeleteRequest(readOnly)).toBeNull();
  });

  it("encodes ids imported from v2", () => {
    const entry = { id: "a b/ć", url: "u", expire: "never", createdAt: "", secretKey: "k" };
    expect(buildDeleteRequest(entry)?.path).toBe(`/api/v1/links/${encodeURIComponent("a b/ć")}`);
    expect(statsPath("a b")).toBe("/a%20b/stats");
    expect(shortUrl("https://dzaj.co", "a b")).toBe("https://dzaj.co/a%20b");
  });

  it("removes the entry on 204 and 404 only", () => {
    expect(deleteOutcome(204)).toBe("removed");
    expect(deleteOutcome(404)).toBe("removed");
    expect(deleteOutcome(429)).toBe("rate_limited");
    expect(deleteOutcome(400)).toBe("key_rejected");
    expect(deleteOutcome(403)).toBe("key_rejected");
    for (const status of [500, 0]) expect(deleteOutcome(status)).toBe("failed");
  });

  it("removeEntry drops one id", () => {
    expect(removeEntry(parseHistory(V2_FIXTURE), "abcd").map((e) => e.id)).toEqual([
      "moje-linki",
      "stary",
    ]);
  });
});

describe("large histories", () => {
  const many = JSON.stringify(
    Array.from({ length: MAX_RENDERED + 50 }, (_, i) => ({
      id: `id${i}`,
      url: "https://a.example",
      expire: "never",
      createdAt: new Date(Date.UTC(2024, 0, 1) + i * 1000).toISOString(),
    })),
  );

  it("parses every entry so a write-back never loses any", () => {
    expect(parseHistory(many)).toHaveLength(MAX_RENDERED + 50);
  });

  it("renders at most MAX_RENDERED, newest first", () => {
    const shown = visibleEntries(parseHistory(many));
    expect(shown).toHaveLength(MAX_RENDERED);
    expect(shown[0]?.id).toBe(`id${MAX_RENDERED + 49}`);
  });
});

describe("upsertEntry", () => {
  const old = {
    id: "promo",
    url: "https://example.com/a",
    expire: "2020-01-01T00:00:00.000Z",
    createdAt: "2019-12-01T10:00:00.000Z",
    secretKey: "old-key",
  };
  const fresh = {
    id: "promo",
    url: "https://example.com/b",
    expire: "never",
    createdAt: "2026-11-01T10:00:00.000Z",
    secretKey: "new-key",
  };

  it("replaces an entry of a re-created name with the new key and expiry", () => {
    const other = {
      id: "other",
      url: "https://example.org",
      expire: "never",
      createdAt: "2025-01-01T00:00:00.000Z",
    };
    expect(upsertEntry([old, other], fresh)).toEqual([other, fresh]);
  });

  it("appends an entry with a new id", () => {
    expect(upsertEntry([old], { ...fresh, id: "next" })).toHaveLength(2);
  });
});

describe("adding a link with its key", () => {
  it("maps the stats answer to an outcome", () => {
    expect(addOutcome(200)).toBe("ok");
    expect(addOutcome(403)).toBe("key_rejected");
    expect(addOutcome(404)).toBe("not_found");
    expect(addOutcome(410)).toBe("not_found");
    expect(addOutcome(429)).toBe("rate_limited");
    expect(addOutcome(0)).toBe("failed");
    expect(addOutcome(500)).toBe("failed");
  });

  it("sets the key on an entry that is already there and keeps the rest", () => {
    const readOnly = {
      id: "abcd",
      url: "https://example.com",
      expire: "never",
      createdAt: "2024-01-01T00:00:00.000Z",
    };
    const other = { ...readOnly, id: "other" };
    expect(withKey([readOnly, other], "abcd", "k")).toEqual([
      { ...readOnly, secretKey: "k" },
      other,
    ]);
  });

  it("has nothing to update when the link is not in the history", () => {
    expect(withKey([], "abcd", "k")).toBeNull();
  });

  it("builds an entry from the link details", () => {
    expect(
      entryFromLink(
        {
          id: "abcd",
          url: "https://example.com/",
          expiresAt: "2099-01-01T00:00:00.000Z",
          createdAt: "2026-11-01T10:00:00.000Z",
        },
        "k",
      ),
    ).toEqual({
      id: "abcd",
      url: "https://example.com/",
      expire: "2099-01-01T00:00:00.000Z",
      createdAt: "2026-11-01T10:00:00.000Z",
      secretKey: "k",
    });
  });

  it("reads a missing expiry as never and a missing date as unknown", () => {
    expect(
      entryFromLink({ id: "abcd", url: "https://example.com/", expiresAt: null }, "k"),
    ).toEqual(expect.objectContaining({ expire: "never", createdAt: "" }));
  });

  it("rejects a body that is not a link", () => {
    expect(entryFromLink(null, "k")).toBeNull();
    expect(entryFromLink({ error: { code: "not_found" } }, "k")).toBeNull();
    expect(entryFromLink({ id: "abcd", url: 5 }, "k")).toBeNull();
  });
});
