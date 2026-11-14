// Loads the effect of the seasonal event the server picked (`data-event` on this script's tag).
// The server only adds the tag inside an event window. Nothing runs under reduced motion, and the
// effect stops if the preference turns on later.

import { EVENT_NAMES, type EventName } from "../shared/events";

interface Effect {
  start(options?: { text?: boolean }): () => void;
}

function isEventName(value: string | undefined): value is EventName {
  return EVENT_NAMES.includes(value as EventName);
}

async function run(): Promise<void> {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduced.matches) return;
  const name = document.querySelector<HTMLScriptElement>("script[data-event]")?.dataset.event;
  if (!isEventName(name)) return;
  const file = name === "anniversary" ? "confetti" : name;
  // A variable path keeps each effect in its own bundle, fetched only now.
  const effect = (await import(`/assets/event-${file}.js`)) as Effect;
  const stop = effect.start(name === "anniversary" ? { text: true } : undefined);
  reduced.addEventListener("change", () => {
    if (reduced.matches) stop();
  });
}

run().catch(() => {});
