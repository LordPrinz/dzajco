import { Layout } from "./Layout";

export interface Endpoint {
  method: "GET" | "POST" | "DELETE";
  path: string;
  summary: string;
  input: string;
  responses: readonly { status: string; body: string }[];
}

/** The API v1 contract, as served by the Worker. A test keeps this list and the error table complete. */
export const ENDPOINTS: readonly Endpoint[] = [
  {
    method: "POST",
    path: "/api/v1/links",
    summary: "Tworzy link. Wymaga nagłówka Content-Type: application/json.",
    input: "JSON: url (wymagane), customName (opcjonalne), expiresAt (ISO 8601 lub null).",
    responses: [
      {
        status: "201",
        body: "{ id, shortUrl, url, secretKey, expiresAt }. url to adres docelowy po normalizacji (host w punycode).",
      },
      { status: "400", body: "invalid_json, invalid_body albo kod domenowy z tabeli poniżej." },
      { status: "409", body: "id_taken" },
      { status: "413", body: "payload_too_large (ciało większe niż 8 KB)" },
      { status: "415", body: "unsupported_media_type" },
      { status: "429", body: "rate_limited" },
      { status: "503", body: "service_unavailable" },
    ],
  },
  {
    method: "GET",
    path: "/api/v1/links/:id",
    summary: "Zwraca adres docelowy linku bez przekierowania.",
    input: "Brak.",
    responses: [
      { status: "200", body: "{ id, url, expiresAt }" },
      { status: "404", body: "not_found" },
      { status: "410", body: "expired albo link_disabled" },
      { status: "429", body: "rate_limited" },
    ],
  },
  {
    method: "GET",
    path: "/api/v1/links/:id/stats",
    summary:
      "Statystyki linku. Bez nagłówka Authorization widok publiczny, z poprawnym kluczem widok właściciela.",
    input: "Opcjonalnie Authorization: Bearer <klucz>.",
    responses: [
      {
        status: "200",
        body: "{ visits, countries: [{ code, visits }], partial }. Z kluczem dodatkowo cities.",
      },
      {
        status: "403",
        body: "forbidden. Dotyczy każdego nagłówka Authorization, który nie jest poprawnym kluczem tego linku. Nie ma powrotu do widoku publicznego.",
      },
      { status: "404", body: "not_found" },
      { status: "410", body: "expired albo link_disabled" },
      { status: "429", body: "rate_limited" },
    ],
  },
  {
    method: "DELETE",
    path: "/api/v1/links/:id",
    summary: "Usuwa link razem z jego statystykami.",
    input: "Authorization: Bearer <klucz>. Ciało jest ignorowane.",
    responses: [
      { status: "204", body: "Bez treści." },
      { status: "400", body: "invalid_key (brak klucza albo zły format)" },
      { status: "403", body: "forbidden (klucz nie pasuje do linku)" },
      { status: "404", body: "not_found" },
      { status: "429", body: "rate_limited" },
    ],
  },
  {
    method: "GET",
    path: "/api/v1/stats",
    summary: "Statystyki całego serwisu.",
    input: "Brak.",
    responses: [
      {
        status: "200",
        body: "{ links, visits, countries: [{ code, visits }], updatedAt }. Liczby przelicza się raz na dobę i mogą się spóźniać o około 24 godziny.",
      },
      { status: "429", body: "rate_limited" },
    ],
  },
];

export interface ErrorCode {
  status: number;
  code: string;
  meaning: string;
}

/** Every error code the API can return. */
export const ERROR_CODES: readonly ErrorCode[] = [
  { status: 400, code: "invalid_json", meaning: "Ciało żądania nie jest poprawnym JSON-em." },
  {
    status: 400,
    code: "invalid_body",
    meaning: "Ciało nie pasuje do schematu: brak url, pole o złym typie albo nieznane pole.",
  },
  { status: 400, code: "invalid_url", meaning: "url nie jest poprawnym adresem URL." },
  { status: 400, code: "unsupported_scheme", meaning: "Dozwolone są tylko http: i https:." },
  { status: 400, code: "url_too_long", meaning: "url ma więcej niż 2048 znaków." },
  {
    status: 400,
    code: "credentials_not_allowed",
    meaning: "Adres zawiera dane logowania (user:hasło@).",
  },
  { status: 400, code: "own_host", meaning: "Adres prowadzi do tego serwisu." },
  {
    status: 400,
    code: "private_target",
    meaning: "Adres lokalny, prywatny lub zastrzeżony (IPv4, IPv6, localhost).",
  },
  {
    status: 400,
    code: "blocked_target",
    meaning: "Adres jest innym skracaczem linków albo znajduje się na liście zablokowanych.",
  },
  {
    status: 400,
    code: "invalid_name",
    meaning: "customName ma mieć 3 do 32 liter, cyfr, znaków _ lub -.",
  },
  { status: 400, code: "name_too_long", meaning: "customName jest za długie." },
  { status: 400, code: "reserved_name", meaning: "customName jest zarezerwowane przez serwis." },
  {
    status: 400,
    code: "mixed_script",
    meaning: "customName miesza alfabet łaciński z innym pismem.",
  },
  {
    status: 400,
    code: "invalid_expiry",
    meaning: "expiresAt nie jest istniejącą datą w formacie ISO 8601.",
  },
  { status: 400, code: "expiry_in_past", meaning: "expiresAt jest w przeszłości." },
  {
    status: 400,
    code: "expiry_too_far",
    meaning: "expiresAt jest dalej niż rok od teraz.",
  },
  {
    status: 400,
    code: "invalid_key",
    meaning: "DELETE bez klucza albo z kluczem w złym formacie.",
  },
  { status: 403, code: "forbidden", meaning: "Klucz nie pasuje do linku." },
  { status: 404, code: "not_found", meaning: "Taki link nie istnieje." },
  { status: 409, code: "id_taken", meaning: "customName jest już zajęte." },
  { status: 410, code: "expired", meaning: "Link wygasł." },
  { status: 410, code: "link_disabled", meaning: "Link został wyłączony z powodu nadużycia." },
  { status: 413, code: "payload_too_large", meaning: "Ciało żądania ma więcej niż 8 KB." },
  {
    status: 415,
    code: "unsupported_media_type",
    meaning: "Content-Type musi być application/json.",
  },
  { status: 429, code: "rate_limited", meaning: "Przekroczony limit żądań. Zobacz Retry-After." },
  { status: 500, code: "internal_error", meaning: "Błąd serwera." },
  {
    status: 503,
    code: "service_unavailable",
    meaning: "Sprawdzenie listy zablokowanych adresów nie powiodło się. Spróbuj później.",
  },
];

const LIMITS = [
  { route: "POST /api/v1/links", limit: "10 na minutę" },
  { route: "DELETE /api/v1/links/:id", limit: "10 na minutę" },
  { route: "GET /api/v1/links/:id", limit: "120 na minutę, wspólny z przekierowaniami GET /:id" },
  { route: "GET /api/v1/links/:id/stats, GET /api/v1/stats", limit: "60 na minutę" },
] as const;

const MIGRATION = [
  {
    v2: "GET /api/urls/{shortUrl}",
    v3: "GET /api/v1/links/:id",
    changes: "Odpowiedź { id, url, expiresAt } zamiast { fullLink }.",
  },
  {
    v2: "GET /api/urls/{shortUrl}/info",
    v3: "GET /api/v1/links/:id/stats",
    changes:
      "Odpowiedź { visits, countries, partial }. Miasta (cities) tylko z kluczem. Strona /:id/info przekierowuje (301) na /:id/stats.",
  },
  {
    v2: "POST /api/urls",
    v3: "POST /api/v1/links",
    changes:
      "Pole expire to teraz expiresAt (ISO 8601 lub null). Odpowiedź 201: { id, shortUrl, url, secretKey, expiresAt }, bez message. Błędy walidacji mają status 400 zamiast 422, zajęta nazwa 409. Wymagany Content-Type: application/json.",
  },
  {
    v2: "DELETE /api/urls/{shortUrl}",
    v3: "DELETE /api/v1/links/:id",
    changes:
      "Klucz idzie w nagłówku Authorization: Bearer <klucz>, nie w ciele { secretKey } i nigdy w adresie. Sukces to 204 bez treści.",
  },
] as const;

function Method({ method }: { method: Endpoint["method"] }) {
  return <span class={`method method--${method.toLowerCase()}`}>{method}</span>;
}

function Code({ children }: { children: string }) {
  return (
    <pre class="code" tabindex={0}>
      <code>{children}</code>
    </pre>
  );
}

export function ApiDocs({ nonce, origin }: { nonce: string; origin: string }) {
  const createExample = `curl -X POST ${origin}/api/v1/links \\
  -H 'Content-Type: application/json' \\
  -d '{"url":"https://example.com/dlugi/adres","customName":"moj-link","expiresAt":null}'`;
  const createResponse = `{
  "id": "moj-link",
  "shortUrl": "${origin}/moj-link",
  "url": "https://example.com/dlugi/adres",
  "secretKey": "Zx3k...22 znaki",
  "expiresAt": null
}`;
  const statsExample = `curl ${origin}/api/v1/links/moj-link/stats
curl -H 'Authorization: Bearer <klucz>' ${origin}/api/v1/links/moj-link/stats`;
  const deleteExample = `curl -X DELETE -H 'Authorization: Bearer <klucz>' ${origin}/api/v1/links/moj-link`;
  const errorExample = `{ "error": { "code": "id_taken", "message": "customName is already taken" } }`;

  return (
    <Layout nonce={nonce} title="API" styles={["pages.css"]}>
      <article class="doc doc--wide">
        <h1 class="doc__title">API dzajco v1</h1>
        <p class="doc__lead">
          Publiczne API JSON do tworzenia, odczytu i usuwania linków. Adres bazowy:{" "}
          <code>{origin}</code>.
        </p>

        <nav class="toc" aria-label="Spis treści">
          <ul>
            <li>
              <a href="#endpointy">Endpointy</a>
            </li>
            <li>
              <a href="#bledy">Błędy</a>
            </li>
            <li>
              <a href="#limity">Limity</a>
            </li>
            <li>
              <a href="#cors">CORS i klucz</a>
            </li>
            <li>
              <a href="#przyklady">Przykłady</a>
            </li>
            <li>
              <a href="#migracja">Migracja z v2</a>
            </li>
          </ul>
        </nav>

        <section class="doc__section" id="endpointy" aria-labelledby="h-endpointy">
          <h2 id="h-endpointy">Endpointy</h2>
          {ENDPOINTS.map((endpoint) => (
            <section class="endpoint" aria-label={`${endpoint.method} ${endpoint.path}`}>
              <h3 class="endpoint__title">
                <Method method={endpoint.method} /> <code>{endpoint.path}</code>
              </h3>
              <p>{endpoint.summary}</p>
              <p>
                <strong>Wejście.</strong> {endpoint.input}
              </p>
              <table class="table">
                <thead>
                  <tr>
                    <th scope="col">Status</th>
                    <th scope="col">Treść</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoint.responses.map((response) => (
                    <tr>
                      <td>
                        <code>{response.status}</code>
                      </td>
                      <td>{response.body}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </section>

        <section class="doc__section" id="bledy" aria-labelledby="h-bledy">
          <h2 id="h-bledy">Błędy</h2>
          <p>Każdy błąd ma ten sam kształt:</p>
          <Code>{errorExample}</Code>
          <table class="table">
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col">Kod</th>
                <th scope="col">Znaczenie</th>
              </tr>
            </thead>
            <tbody>
              {ERROR_CODES.map((error) => (
                <tr>
                  <td>
                    <code>{error.status}</code>
                  </td>
                  <td>
                    <code>{error.code}</code>
                  </td>
                  <td>{error.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section class="doc__section" id="limity" aria-labelledby="h-limity">
          <h2 id="h-limity">Limity</h2>
          <p>
            Limity liczone są osobno dla każdego adresu IP w oknie 60 sekund. Po przekroczeniu
            dostajesz 429 z nagłówkiem <code>Retry-After</code>. Limity działają w każdej
            lokalizacji osobno, więc to ochrona przed nadużyciem, nie dokładny licznik.
          </p>
          <table class="table">
            <thead>
              <tr>
                <th scope="col">Trasa</th>
                <th scope="col">Limit</th>
              </tr>
            </thead>
            <tbody>
              {LIMITS.map((row) => (
                <tr>
                  <td>
                    <code>{row.route}</code>
                  </td>
                  <td>{row.limit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section class="doc__section" id="cors" aria-labelledby="h-cors">
          <h2 id="h-cors">CORS, klucz i nagłówki</h2>
          <ul>
            <li>
              Odpowiedzi <code>GET</code> mają <code>Access-Control-Allow-Origin: *</code>. Serwer
              nigdy nie odbija nagłówka <code>Origin</code> i nie zezwala na dane uwierzytelniające.
            </li>
            <li>
              <code>POST</code> i <code>DELETE</code> nie mają CORS. Wywołuj je z serwera albo z tej
              samej domeny.
            </li>
            <li>
              Klucz (<code>secretKey</code>) dostajesz raz, w odpowiedzi 201. Ma 22 znaki
              (base64url). Klucze linków przeniesionych z v2 mają 12 znaków (A-Z, a-z, 0-9, _, -) i
              działają tak samo. Wysyłaj go jako <code>Authorization: Bearer &lt;klucz&gt;</code>{" "}
              (nazwa schematu bez rozróżniania wielkości liter). Nigdy w adresie ani w zapytaniu.
            </li>
            <li>
              Każdy link ma własny klucz. Odpowiedź 201, odpowiedź ze statystykami właściciela i
              strona wyniku mają <code>Cache-Control: no-store</code>.
            </li>
            <li>
              Odpowiedzi JSON mają <code>Content-Security-Policy: default-src 'none'</code>.
            </li>
          </ul>
        </section>

        <section class="doc__section" id="przyklady" aria-labelledby="h-przyklady">
          <h2 id="h-przyklady">Przykłady</h2>
          <h3 class="doc__subtitle">Utworzenie linku</h3>
          <Code>{createExample}</Code>
          <p>Odpowiedź 201:</p>
          <Code>{createResponse}</Code>
          <h3 class="doc__subtitle">Statystyki publiczne i właściciela</h3>
          <Code>{statsExample}</Code>
          <h3 class="doc__subtitle">Usunięcie linku</h3>
          <Code>{deleteExample}</Code>
          <p>
            Pole <code>partial</code> w statystykach ma wartość <code>true</code>, gdy najnowszych
            wejść nie udało się odczytać. Dane z poprzednich dób są wtedy kompletne.
          </p>
        </section>

        <section class="doc__section" id="migracja" aria-labelledby="h-migracja">
          <h2 id="h-migracja">Migracja z v2</h2>
          <p>
            Stare adresy <code>/api/urls</code> nie mają aliasu. Adres <code>/dzajapi</code>{" "}
            przekierowuje (301) tutaj. Zmień wywołania według tabeli.
          </p>
          <table class="table">
            <thead>
              <tr>
                <th scope="col">Endpoint w v2</th>
                <th scope="col">Endpoint w v1</th>
                <th scope="col">Co się zmieniło</th>
              </tr>
            </thead>
            <tbody>
              {MIGRATION.map((row) => (
                <tr>
                  <td>
                    <code>{row.v2}</code>
                  </td>
                  <td>
                    <code>{row.v3}</code>
                  </td>
                  <td>{row.changes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul>
            <li>
              Błędy mają postać <code>{`{ error: { code, message } }`}</code> zamiast{" "}
              <code>{`{ error: "..." }`}</code>. Rozpoznawaj je po <code>code</code>.
            </li>
          </ul>
        </section>
      </article>
    </Layout>
  );
}
