export type ExpiryError = "invalid_expiry" | "expiry_in_past" | "expiry_too_far";
export type ExpiryResult =
  | { ok: true; expiresAt: number | null }
  | { ok: false; code: ExpiryError };

const ISO =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** The calendar date, hour, minute and second must exist as written; `Date.parse` rolls `02-30` and `T24:00` over. */
function existsAsWritten(match: RegExpExecArray): boolean {
  const [year, month, day, hour, minute, second] = match.slice(1).map((p) => Number(p ?? 0)) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59
  );
}

export function parseExpiry(input: string | null, now: number): ExpiryResult {
  if (input === null) return { ok: true, expiresAt: null };
  const match = ISO.exec(input);
  if (!match || !existsAsWritten(match)) return { ok: false, code: "invalid_expiry" };
  const at = Date.parse(input);
  if (Number.isNaN(at)) return { ok: false, code: "invalid_expiry" };
  if (at <= now) return { ok: false, code: "expiry_in_past" };
  if (at > addOneYear(now)) return { ok: false, code: "expiry_too_far" };
  return { ok: true, expiresAt: at };
}

function addOneYear(now: number): number {
  const d = new Date(now);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.getTime();
}
