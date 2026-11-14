export interface ResultCardProps {
  id: string;
  shortUrl: string;
  target: string;
  secretKey: string;
  host: string;
  isIdn: boolean;
  /** Pre-formatted expiry or null. */
  expiresLabel: string | null;
  expiresAt: string | null;
}

/**
 * The result of a creation. Rendered by `Created` on the no-JS path and, empty, inside a `<template>` on
 * the home page: the browser script clones the template and fills the `data-field` elements.
 */
export function ResultCard(props: ResultCardProps) {
  const statsHref = props.id === "" ? "" : `/${encodeURIComponent(props.id)}/stats`;
  return (
    <section
      class="result"
      aria-labelledby="result-title"
      data-created=""
      data-id={props.id}
      data-url={props.target}
      data-expire={props.expiresAt ?? "never"}
    >
      <h2 class="result__title" id="result-title" tabindex={-1}>
        Twój link jest gotowy
      </h2>

      <div class="field">
        <span class="field__label">Krótki link</span>
        <div class="copy-row">
          <a class="copy-row__value" data-field="shortUrl" href={props.shortUrl}>
            {props.shortUrl}
          </a>
          <button type="button" class="button button--ghost" data-copy="shortUrl" hidden>
            Kopiuj
          </button>
        </div>
      </div>

      <p class="result__target">
        Prowadzi do: <span data-field="target">{props.target}</span>
      </p>
      <p class="notice notice--idn" data-field="idn" hidden={!props.isIdn}>
        Adres docelowy używa znaków międzynarodowych. Faktyczna domena (punycode):{" "}
        <code data-field="host">{props.host}</code>. Sprawdź, czy to na pewno ta strona.
      </p>
      <p class="result__expiry" data-field="expiry" hidden={props.expiresLabel === null}>
        Wygasa: <time datetime={props.expiresAt ?? ""}>{props.expiresLabel}</time>
      </p>

      <div class="notice notice--warning" role="note">
        <p class="notice__title">Zapisz klucz</p>
        <p>
          Poniższy klucz pozwala usunąć link i zobaczyć jego pełne statystyki. Zapisz go, nie
          pokażemy go ponownie.
        </p>
        <div class="copy-row">
          <code class="copy-row__value copy-row__value--key" data-field="secretKey">
            {props.secretKey}
          </code>
          <button type="button" class="button button--ghost" data-copy="secretKey" hidden>
            Kopiuj
          </button>
        </div>
      </div>

      <p class="sr-only" role="status" data-field="copied" />

      <div class="result__actions">
        <a class="button button--ghost" data-field="stats" href={statsHref}>
          Statystyki
        </a>
        <a class="button" href="/">
          Skróć kolejny
        </a>
      </div>
    </section>
  );
}
