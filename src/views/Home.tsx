import { CUSTOM_EXPIRY, EXPIRY_PRESETS, errorText, FIELD_OF_ERROR } from "../shared/form";
import { Header } from "./Header";
import { Layout } from "./Layout";
import { usePage } from "./page-context";
import { ResultCard } from "./ResultCard";

export interface HomeValues {
  url: string;
  customName: string;
  expiry: string;
  customDate: string;
}

export const EMPTY_VALUES: HomeValues = {
  url: "",
  customName: "",
  expiry: "never",
  customDate: "",
};

export interface HomeProps {
  nonce: string;
  values?: HomeValues;
  /** Error code of a rejected submission. */
  error?: string;
}

export function Home({ nonce, values = EMPTY_VALUES, error }: HomeProps) {
  const field = error === undefined ? undefined : (FIELD_OF_ERROR[error] ?? "url");
  const { t } = usePage();
  const message = error === undefined ? undefined : errorText(error, t.common);
  // Each error sits next to its field: the link's under the pill, the others inside the options.
  const urlMessage = field === "url" ? message : undefined;
  const optionsMessage = field !== undefined && field !== "url" ? message : undefined;
  const hasOptions =
    values.customName !== "" ||
    values.expiry !== "never" ||
    (field !== undefined && field !== "url");
  return (
    <Layout nonce={nonce} scripts={["form.js"]}>
      <Header />

      {/* Before the forms, so a result shows right under the hero; the script hides the forms then. */}
      <div id="result-slot" />

      <form class="shorten" id="shorten-form" method="post" action="/" novalidate>
        <div class="pill">
          <label class="sr-only" for="url">
            {t.home.urlLabel}
          </label>
          <input
            class="input pill__input"
            id="url"
            name="url"
            type="text"
            inputmode="url"
            autocomplete="url"
            autocapitalize="off"
            spellcheck={false}
            maxlength={2048}
            placeholder={t.home.urlPlaceholder}
            required
            value={values.url}
            aria-invalid={field === "url" ? "true" : undefined}
            aria-describedby={field === "url" ? "form-error" : undefined}
          />
          <button class="pill__submit" type="submit">
            {t.home.submit}
          </button>
        </div>
        {/* Right under the field it describes; role=alert reads it out when it appears. */}
        <p class="error" id="form-error" role="alert" hidden={urlMessage === undefined}>
          {urlMessage}
        </p>

        <details class="options" open={hasOptions}>
          <summary class="options__summary">{t.home.moreOptions}</summary>
          <div class="options__body">
            <label class="sr-only" for="customName">
              {t.home.customName}
            </label>
            <input
              class="input"
              id="customName"
              name="customName"
              type="text"
              autocomplete="off"
              autocapitalize="off"
              spellcheck={false}
              maxlength={128}
              placeholder={t.home.customName}
              value={values.customName}
              aria-invalid={field === "customName" ? "true" : undefined}
              aria-describedby={field === "customName" ? "options-error" : undefined}
            />

            <div class="expiry">
              <label class="expiry__label" for="expiry">
                {t.home.expiry}
              </label>
              <select
                class="expiry__select"
                id="expiry"
                name="expiry"
                aria-invalid={field === "expiry" ? "true" : undefined}
                aria-describedby={field === "expiry" ? "options-error" : undefined}
              >
                {EXPIRY_PRESETS.map((preset) => (
                  <option value={preset.value} selected={values.expiry === preset.value}>
                    {t.common.expiry[preset.value]}
                  </option>
                ))}
                <option value={CUSTOM_EXPIRY} selected={values.expiry === CUSTOM_EXPIRY}>
                  {t.common.expiry.custom}
                </option>
              </select>
            </div>
            <div class="custom-date" id="custom-date">
              <label class="sr-only" for="customDate" id="custom-date-label">
                {t.home.customDateLabel}
              </label>
              <input
                class="input"
                id="customDate"
                name="customDate"
                type="datetime-local"
                value={values.customDate}
              />
              <p class="hint" id="custom-date-hint">
                {t.home.customDateHint}
              </p>
            </div>
            <p class="error" id="options-error" role="alert" hidden={optionsMessage === undefined}>
              {optionsMessage}
            </p>
          </div>
        </details>
        <p class="sr-only" role="status" id="form-status" />
      </form>

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

      <template id="result-template">
        <ResultCard
          id=""
          shortUrl=""
          target=""
          secretKey=""
          host=""
          isIdn={false}
          expiresAt={null}
          expiresLabel={null}
        />
      </template>
    </Layout>
  );
}
