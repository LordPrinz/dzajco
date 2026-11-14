import { Layout } from "./Layout";

/**
 * The shell of `/history`. The list is built in the browser by `history.js` from `links-history`
 * (localStorage), so the server never sees it.
 */
export function History({ nonce }: { nonce: string }) {
  return (
    <Layout nonce={nonce} title="Historia" scripts={["history.js"]} styles={["pages.css"]}>
      <article class="doc">
        <h1 class="doc__title">Historia linków</h1>
        <p class="doc__lead">
          Linki utworzone w tej przeglądarce. Lista jest zapisana tylko tutaj, na Twoim urządzeniu.
        </p>

        <p class="sr-only" role="status" id="history-status" />
        <p id="history-loading" class="history__empty">
          Wczytywanie historii…
        </p>
        <noscript>
          <p class="notice notice--warning">Historia wymaga włączonego JavaScriptu.</p>
        </noscript>
        <ul class="history" id="history-list" />
        <p class="history__empty" id="history-empty" hidden>
          Brak zapisanych linków. <a href="/">Skróć pierwszy link</a>.
        </p>
        <p class="doc__note">
          Usunąć można tylko linki zapisane razem z kluczem. Wpisy bez klucza są tylko do odczytu.
        </p>
      </article>
    </Layout>
  );
}
