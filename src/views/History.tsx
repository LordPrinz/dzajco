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

        <noscript>
          <p class="notice notice--warning">{t.history.noscript}</p>
        </noscript>
        <ul class="history" id="history-list" />
        <p class="history__empty" id="history-empty" tabIndex={-1} hidden>
          {t.history.empty} <a href="/">{t.history.emptyLink}</a>.
        </p>
        <p class="doc__note" id="history-note" hidden>
          {t.history.note}
        </p>

        {/* Hidden until history.js runs. */}
        <form class="doc__section add-key" id="add-key-form" aria-labelledby="add-key-title" hidden>
          <h2 id="add-key-title" tabindex={-1}>
            {t.history.add.heading}
          </h2>
          <p class="add-key__lead">{t.history.add.lead}</p>
          <label class="field__label" for="add-key-code">
            {t.history.add.codeLabel}
          </label>
          <input
            class="input"
            id="add-key-code"
            name="code"
            type="text"
            required
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck={false}
          />
          <label class="field__label" for="add-key-secret">
            {t.history.add.keyLabel}
          </label>
          <input
            class="input"
            id="add-key-secret"
            name="secretKey"
            type="text"
            required
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck={false}
          />
          <p class="error" id="add-key-error" role="alert" hidden />
          <button class="button add-key__submit" type="submit">
            {t.history.add.submit}
          </button>
          <p class="sr-only" id="add-key-status" role="status" />
        </form>
      </article>
    </Layout>
  );
}
