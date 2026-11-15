import { Header } from "./Header";
import { Layout } from "./Layout";
import { usePage } from "./page-context";
import { Shorten, type ShortenValues } from "./Shorten";

export interface HomeProps {
  nonce: string;
  values?: ShortenValues;
  /** Error code of a rejected submission. */
  error?: string;
}

export function Home({ nonce, values, error }: HomeProps) {
  const { t } = usePage();
  return (
    <Layout nonce={nonce} scripts={["form.js"]}>
      <Header />
      <Shorten values={values} error={error} />

      <form class="lookup" id="lookup-form" action="/" method="get" hidden>
        <h2 class="lookup__title">
          <span>{t.home.lookupTitle}</span>
        </h2>
        <div class="pill">
          <label class="sr-only" for="lookup-code">
            {t.home.lookupLabel}
          </label>
          <input
            class="input pill__input"
            id="lookup-code"
            type="text"
            autocomplete="off"
            autocapitalize="off"
            spellcheck={false}
            placeholder={t.home.lookupPlaceholder}
          />
          <button class="pill__submit" type="submit">
            {t.home.lookupSubmit}
          </button>
        </div>
      </form>
    </Layout>
  );
}
