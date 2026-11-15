import { LANGS, type Lang } from "../shared/lang";
import { usePage } from "./page-context";

/** Each language is named in itself, so a visitor finds theirs whatever the page language is. */
const AUTONYM: Record<Lang, string> = { pl: "polski", en: "English" };

/**
 * One submit button per language. The server stores the choice in a cookie and redirects back, so
 * the page comes back fully in the new language with or without JavaScript.
 */
export function LangSwitch() {
  const { lang, path, t } = usePage();
  return (
    <form class="switch" method="post" action="/prefs/lang">
      <input type="hidden" name="back" value={path} />
      <fieldset class="switch__group">
        <legend class="sr-only">{t.settings.language}</legend>
        {LANGS.map((option) => (
          <button
            class="switch__option switch__option--text"
            type="submit"
            name="lang"
            value={option}
            aria-pressed={option === lang ? "true" : "false"}
          >
            <span aria-hidden="true">{option.toUpperCase()}</span>
            <span class="sr-only" lang={option}>
              {AUTONYM[option]}
            </span>
          </button>
        ))}
      </fieldset>
    </form>
  );
}
