import type { Child } from "hono/jsx";
import type { Theme } from "../shared/theme";
import { usePage } from "./page-context";

const OPTIONS: readonly { value: Theme; label: string; icon: Child }[] = [
  {
    value: "system",
    label: "Motyw systemowy",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </>
    ),
  },
  {
    value: "light",
    label: "Jasny motyw",
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </>
    ),
  },
  {
    value: "dark",
    label: "Ciemny motyw",
    icon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  },
];

/**
 * System / light / dark as three submit buttons of one form, so the switch works without JavaScript;
 * `theme.js` applies the choice in place and saves it with the same request.
 */
export function ThemeSwitch() {
  const { theme, path } = usePage();
  return (
    <form class="switch" method="post" action="/prefs/theme" data-theme-switch>
      <input type="hidden" name="back" value={path} />
      <fieldset class="switch__group">
        <legend class="sr-only">Motyw</legend>
        {OPTIONS.map((option) => (
          <button
            class="switch__option"
            type="submit"
            name="theme"
            value={option.value}
            title={option.label}
            aria-label={option.label}
            aria-pressed={option.value === theme ? "true" : "false"}
          >
            <svg
              class="switch__icon"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              {option.icon}
            </svg>
          </button>
        ))}
      </fieldset>
    </form>
  );
}
