// Shared by the server and the theme script, so keep it free of runtime imports.

/** `system` follows `prefers-color-scheme`; the other two pin the theme. */
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = "theme";
export const THEME_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export function parseTheme(value: string | null | undefined): Theme {
  return THEMES.find((theme) => theme === value) ?? "system";
}
