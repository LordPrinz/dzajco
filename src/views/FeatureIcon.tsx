import type { Child } from "hono/jsx";

export type FeatureIconName = "login" | "expiry" | "name" | "delete" | "visitors" | "history";

// Drawn on a 24px grid with a 2px round stroke so they match each other at any size.
const PATHS: Record<FeatureIconName, Child> = {
  login: (
    <>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M4 12h11" />
      <path d="m11 8 4 4-4 4" />
    </>
  ),
  expiry: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2" />
      <path d="M10 2h4" />
    </>
  ),
  name: (
    <>
      <path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  delete: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="m6 7 1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  visitors: (
    <>
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8.3" />
      <path d="M3 3v5.3h5.3" />
      <path d="M12 7v5l3 2" />
    </>
  ),
};

/** A decorative feature icon; the text next to it carries the meaning. */
export function FeatureIcon({ name }: { name: FeatureIconName }) {
  return (
    <svg
      class="features__icon"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
