// Seasonal events and their date windows, in UTC. Ported from the v2 EventWrapper: snow from 3 to 28
// December, fireworks from 29 December to 6 January, confetti on 29 February, and confetti with a
// greeting from 26 to 28 October (the site's anniversary). The first matching window wins.

export type EventName = "snow" | "fireworks" | "confetti" | "anniversary";

export const EVENT_NAMES: readonly EventName[] = ["snow", "fireworks", "confetti", "anniversary"];

function between(month: number, day: number, from: [number, number], to: [number, number]) {
  const value = month * 100 + day;
  return value >= from[0] * 100 + from[1] && value <= to[0] * 100 + to[1];
}

/** The event that runs on the given day, or `null` outside every window. */
export function activeEvent(date: Date): EventName | null {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  if (between(month, day, [12, 3], [12, 28])) return "snow";
  if (between(month, day, [12, 29], [12, 31]) || between(month, day, [1, 1], [1, 6])) {
    return "fireworks";
  }
  if (month === 2 && day === 29) return "confetti";
  if (between(month, day, [10, 26], [10, 28])) return "anniversary";
  return null;
}
