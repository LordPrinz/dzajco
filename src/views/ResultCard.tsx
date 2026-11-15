import { usePage } from "./page-context";

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
  const { t } = usePage();
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
        {t.result.title}
      </h2>

      <div class="field">
        <span class="field__label">{t.result.shortLink}</span>
        <div class="copy-row">
          <a class="copy-row__value" data-field="shortUrl" href={props.shortUrl}>
            {props.shortUrl}
          </a>
          <button type="button" class="button button--ghost" data-copy="shortUrl" hidden>
            {t.common.copy.button}
          </button>
        </div>
      </div>

      <p class="result__target">
        {t.result.target} <span data-field="target">{props.target}</span>
      </p>
      <p class="notice notice--idn" data-field="idn" hidden={!props.isIdn}>
        {t.result.idn(<code data-field="host">{props.host}</code>)}
      </p>
      <p class="result__expiry" data-field="expiry" hidden={props.expiresLabel === null}>
        {t.result.expires} <time datetime={props.expiresAt ?? ""}>{props.expiresLabel}</time>
      </p>

      <div class="notice notice--warning" role="note">
        <p class="notice__title">{t.result.keyTitle}</p>
        <p>{t.result.keyText}</p>
        <div class="copy-row">
          <code class="copy-row__value copy-row__value--key" data-field="secretKey">
            {props.secretKey}
          </code>
          <button type="button" class="button button--ghost" data-copy="secretKey" hidden>
            {t.common.copy.button}
          </button>
        </div>
      </div>

      <div class="result__actions">
        <a class="button button--ghost" data-field="stats" href={statsHref}>
          {t.result.stats}
        </a>
        <a class="button" href="/">
          {t.result.another}
        </a>
      </div>
    </section>
  );
}
