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

/** `https://dzaj.de/abc` as `dzaj.de/abc`: shorter to read, and what people type anyway. */
export function withoutProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

/**
 * The result of a creation. Rendered by `Created` on the no-JS path and, empty, inside a `<template>` on
 * the home page: the browser script clones the template and fills the `data-field` elements.
 *
 * The short link is the main thing, with Copy as the one filled button next to it. The key box starts
 * as the strong warning, which is right without JavaScript; the script turns it into a quiet note once
 * the key is saved to History, and leaves the warning if saving fails.
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

      <div class="result__link">
        <a
          class="result__short"
          data-field="shortUrl"
          data-value={props.shortUrl}
          href={props.shortUrl}
          aria-label={`${t.result.shortLink}: ${props.shortUrl}`}
        >
          {withoutProtocol(props.shortUrl)}
        </a>
        <div class="result__share">
          <button type="button" class="button result__copy" data-copy="shortUrl" hidden>
            {t.common.copy.button}
          </button>
          <button type="button" class="button button--ghost" data-share hidden>
            {t.result.share}
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

      <div class="notice notice--warning" role="note" data-key-box>
        <p class="notice__title" data-field="keyTitle">
          {t.result.keyTitle}
        </p>
        <p data-field="keyText">{t.result.keyText}</p>
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
        <a class="result__again" href="/">
          {t.result.another}
        </a>
      </div>
    </section>
  );
}
