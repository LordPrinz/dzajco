import { Layout } from "./Layout";
import { usePage } from "./page-context";

/**
 * The shell of `/history`. The list is built in the browser by `history.js` from `links-history`
 * (localStorage), so the server never sees it.
 */
export function History({ nonce }: { nonce: string }) {
  const { t } = usePage();
  return (
    <Layout nonce={nonce} title={t.history.title} scripts={["history.js"]} styles={["pages.css"]}>
      <article class="doc">
        <h1 class="doc__title">{t.history.heading}</h1>
        <p class="doc__lead">{t.history.lead}</p>

        <p id="history-loading" class="history__empty">
          {t.history.loading}
        </p>
        <noscript>
          <p class="notice notice--warning">{t.history.noscript}</p>
        </noscript>
        <ul class="history" id="history-list" />
        <p class="history__empty" id="history-empty" hidden>
          {t.history.empty} <a href="/">{t.history.emptyLink}</a>.
        </p>
        <p class="doc__note">{t.history.note}</p>
      </article>
    </Layout>
  );
}
