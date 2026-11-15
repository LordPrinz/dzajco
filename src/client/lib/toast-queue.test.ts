import { describe, expect, it } from "bun:test";
import { dismissToast, showToast, TOAST_DURATION, type Toast } from "./toast-queue";

const toast = (id: number, message = `m${id}`, variant: Toast["variant"] = "info"): Toast => ({
  id,
  message,
  variant,
});

describe("showToast", () => {
  it("appends a new toast", () => {
    const shown = showToast([toast(1)], toast(2));
    expect(shown.list.map((t) => t.id)).toEqual([1, 2]);
    expect(shown.toast.id).toBe(2);
    expect(shown.added).toBe(true);
    expect(shown.evicted).toEqual([]);
  });

  it("drops the oldest toasts beyond the limit", () => {
    const shown = showToast([toast(1), toast(2), toast(3)], toast(4), 3);
    expect(shown.list.map((t) => t.id)).toEqual([2, 3, 4]);
    expect(shown.evicted).toEqual([1]);
  });

  it("reuses a toast with the same message and variant", () => {
    const list = [toast(1, "Skopiowano", "success")];
    const shown = showToast(list, toast(2, "Skopiowano", "success"));
    expect(shown.added).toBe(false);
    expect(shown.toast.id).toBe(1);
    expect(shown.list).toEqual(list);
  });

  it("keeps the same text in another variant apart", () => {
    const shown = showToast([toast(1, "x", "info")], toast(2, "x", "error"));
    expect(shown.added).toBe(true);
    expect(shown.list).toHaveLength(2);
  });

  it("does not change the list it was given", () => {
    const list = [toast(1), toast(2), toast(3)];
    showToast(list, toast(4), 3);
    expect(list.map((t) => t.id)).toEqual([1, 2, 3]);
  });
});

describe("dismissToast", () => {
  it("removes only the given id", () => {
    expect(dismissToast([toast(1), toast(2)], 1).map((t) => t.id)).toEqual([2]);
    expect(dismissToast([toast(1)], 9).map((t) => t.id)).toEqual([1]);
  });
});

describe("TOAST_DURATION", () => {
  it("auto-dismisses success and info, but keeps errors until closed", () => {
    expect(TOAST_DURATION.success).toBeGreaterThan(0);
    expect(TOAST_DURATION.info).toBeGreaterThan(0);
    expect(TOAST_DURATION.error).toBeNull();
  });
});
