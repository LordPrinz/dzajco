import { CUSTOM_EXPIRY, EXPIRY_PRESETS, errorText, FIELD_OF_ERROR } from "../shared/form";
import { Header } from "./Header";
import { Layout } from "./Layout";
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
  const message = error === undefined ? undefined : errorText(error);
  const hasOptions = values.customName !== "" || values.expiry !== "never" || field !== "url";
  return (
    <Layout nonce={nonce} scripts={["form.js"]}>
      <Header />

      <form class="shorten" id="shorten-form" method="post" action="/" novalidate>
        <p class="error" id="form-error" role="alert" hidden={message === undefined}>
          {message}
        </p>
        <div class="pill">
          <label class="sr-only" for="url">
            Link do skrócenia
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
            placeholder="Link"
            required
            value={values.url}
            aria-invalid={field === "url" ? "true" : undefined}
            aria-describedby={field === "url" ? "form-error" : undefined}
          />
          <button class="pill__submit" type="submit">
            Dżajcuj
          </button>
        </div>

        <details class="options" open={hasOptions}>
          <summary class="options__summary">Więcej opcji</summary>
          <div class="options__body">
            <label class="sr-only" for="customName">
              Własna nazwa
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
              placeholder="Własna nazwa"
              value={values.customName}
              aria-invalid={field === "customName" ? "true" : undefined}
              aria-describedby={field === "customName" ? "form-error" : undefined}
            />

            <div class="expiry">
              <label class="expiry__label" for="expiry">
                Wygasa
              </label>
              <select
                class="expiry__select"
                id="expiry"
                name="expiry"
                aria-invalid={field === "expiry" ? "true" : undefined}
                aria-describedby={field === "expiry" ? "form-error" : undefined}
              >
                {EXPIRY_PRESETS.map((preset) => (
                  <option value={preset.value} selected={values.expiry === preset.value}>
                    {preset.label}
                  </option>
                ))}
                <option value={CUSTOM_EXPIRY} selected={values.expiry === CUSTOM_EXPIRY}>
                  Własna data
                </option>
              </select>
            </div>
            <div class="custom-date" id="custom-date">
              <label class="sr-only" for="customDate" id="custom-date-label">
                Własna data wygaśnięcia (UTC)
              </label>
              <input
                class="input"
                id="customDate"
                name="customDate"
                type="datetime-local"
                value={values.customDate}
              />
              <p class="hint" id="custom-date-hint">
                Czas UTC. Używana tylko przy wyborze „Własna data”.
              </p>
            </div>
          </div>
        </details>
        <p class="sr-only" role="status" id="form-status" />
      </form>

      <form class="lookup" id="lookup-form" action="/" method="get" hidden>
        <h2 class="lookup__title">
          <span>Statystyki linku</span>
        </h2>
        <div class="pill">
          <label class="sr-only" for="lookup-code">
            Skrócony link lub jego kod
          </label>
          <input
            class="input pill__input"
            id="lookup-code"
            type="text"
            autocomplete="off"
            autocapitalize="off"
            spellcheck={false}
            placeholder="Link lub kod"
          />
          <button class="pill__submit" type="submit">
            Pokaż statystyki
          </button>
        </div>
      </form>

      <div id="result-slot" />
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
