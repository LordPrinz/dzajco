// Progressive enhancement of the theme switch. Without this script the switch posts to
// `/prefs/theme`, which sets the cookie and redirects back to the page.

import { parseTheme } from "../shared/theme";

const form = document.querySelector<HTMLFormElement>("form[data-theme-switch]");

form?.addEventListener("submit", (event) => {
  const button = event.submitter;
  if (!(button instanceof HTMLButtonElement)) return;
  event.preventDefault();
  const theme = parseTheme(button.value);

  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  for (const option of form.querySelectorAll<HTMLButtonElement>("button[name=theme]")) {
    option.setAttribute("aria-pressed", String(option === button));
  }

  // The same request as the form, so the server stays the only place that writes the cookie.
  const body = new URLSearchParams({ theme, back: "/" });
  fetch(form.action, { method: "POST", body, redirect: "manual" }).catch(() => {
    // Offline: the theme still applies to this page; the next visit falls back to the old choice.
  });
});
