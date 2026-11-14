import { describe, expect, it } from "bun:test";
import { activeEvent, type EventName } from "./events";

function on(iso: string): EventName | null {
  return activeEvent(new Date(`${iso}T12:00:00Z`));
}

describe("activeEvent", () => {
  it("snows from 3 to 28 December", () => {
    expect(on("2026-12-02")).toBeNull();
    expect(on("2026-12-03")).toBe("snow");
    expect(on("2026-12-15")).toBe("snow");
    expect(on("2026-12-28")).toBe("snow");
  });

  it("shows fireworks from 29 December to 6 January", () => {
    expect(on("2026-12-29")).toBe("fireworks");
    expect(on("2026-12-31")).toBe("fireworks");
    expect(on("2027-01-01")).toBe("fireworks");
    expect(on("2027-01-06")).toBe("fireworks");
    expect(on("2027-01-07")).toBeNull();
  });

  it("throws confetti on 29 February only", () => {
    expect(on("2028-02-29")).toBe("confetti");
    expect(on("2028-02-28")).toBeNull();
    expect(on("2028-03-01")).toBeNull();
  });

  it("celebrates the anniversary from 26 to 28 October", () => {
    expect(on("2026-10-25")).toBeNull();
    expect(on("2026-10-26")).toBe("anniversary");
    expect(on("2026-10-28")).toBe("anniversary");
    expect(on("2026-10-29")).toBeNull();
  });

  it("is quiet on ordinary days", () => {
    expect(on("2026-06-15")).toBeNull();
    expect(on("2026-11-14")).toBeNull();
  });

  it("reads the UTC day, not the local one", () => {
    expect(activeEvent(new Date("2026-12-02T23:59:59Z"))).toBeNull();
    expect(activeEvent(new Date("2026-12-03T00:00:00Z"))).toBe("snow");
  });
});
