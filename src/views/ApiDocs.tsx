import { Layout } from "./Layout";
import { usePage } from "./page-context";
import { ENDPOINTS, type Endpoint, ERROR_CODES, LIMIT_ROUTES, MIGRATION } from "./text/api";

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

// Section ids stay the same in every language, so links to them keep working.
export function ApiDocs({ nonce, origin }: { nonce: string; origin: string }) {
  const { t } = usePage();
  const a = t.api;
  const ex = a.examples;
  const createExample = `curl -X POST ${origin}/api/v1/links \\
  -H 'Content-Type: application/json' \\
  -d '{"url":"https://example.com/${ex.longPath}","customName":"${ex.name}","expiresAt":null}'`;
  const createResponse = `{
  "id": "${ex.name}",
  "shortUrl": "${origin}/${ex.name}",
  "url": "https://example.com/${ex.longPath}",
  "secretKey": "Zx3k...${ex.keySample}",
  "expiresAt": null
}`;
  const statsExample = `curl ${origin}/api/v1/links/${ex.name}/stats
curl -H 'Authorization: Bearer <${ex.key}>' ${origin}/api/v1/links/${ex.name}/stats`;
  const deleteExample = `curl -X DELETE -H 'Authorization: Bearer <${ex.key}>' ${origin}/api/v1/links/${ex.name}`;
  const errorExample = `{ "error": { "code": "id_taken", "message": "customName is already taken" } }`;

  return (
    <Layout nonce={nonce} title={a.title} styles={["pages.css"]}>
      <article class="doc doc--wide">
        <h1 class="doc__title">{a.heading}</h1>
        <p class="doc__lead">{a.lead(<code>{origin}</code>)}</p>

        <nav class="toc" aria-label={a.toc}>
          <ul>
            <li>
              <a href="#endpointy">{a.sections.endpoints}</a>
            </li>
            <li>
              <a href="#bledy">{a.sections.errors}</a>
            </li>
            <li>
              <a href="#limity">{a.sections.limits}</a>
            </li>
            <li>
              <a href="#cors">{a.sections.corsShort}</a>
            </li>
            <li>
              <a href="#przyklady">{a.sections.examples}</a>
            </li>
            <li>
              <a href="#migracja">{a.sections.migration}</a>
            </li>
          </ul>
        </nav>

        <section class="doc__section" id="endpointy" aria-labelledby="h-endpointy">
          <h2 id="h-endpointy">{a.sections.endpoints}</h2>
          {ENDPOINTS.map((endpoint) => {
            const text = a.endpoints[endpoint.id];
            return (
              <section class="endpoint" aria-label={`${endpoint.method} ${endpoint.path}`}>
                <h3 class="endpoint__title">
                  <Method method={endpoint.method} /> <code>{endpoint.path}</code>
                </h3>
                <p>{text.summary}</p>
                <p>
                  <strong>{a.input}</strong> {text.input}
                </p>
                <table class="table">
                  <thead>
                    <tr>
                      <th scope="col" class="table__status">
                        {a.status}
                      </th>
                      <th scope="col">{a.body}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.statuses.map((status) => (
                      <tr>
                        <td class="table__status">
                          <code>{status}</code>
                        </td>
                        <td>{text.responses[status]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}
        </section>

        <section class="doc__section" id="bledy" aria-labelledby="h-bledy">
          <h2 id="h-bledy">{a.sections.errors}</h2>
          <p>{a.errorShape}</p>
          <Code>{errorExample}</Code>
          <table class="table">
            <thead>
              <tr>
                <th scope="col" class="table__status">
                  {a.status}
                </th>
                <th scope="col">{a.code}</th>
                <th scope="col">{a.meaning}</th>
              </tr>
            </thead>
            <tbody>
              {ERROR_CODES.map((error) => (
                <tr>
                  <td class="table__status">
                    <code>{error.status}</code>
                  </td>
                  <td>
                    <code>{error.code}</code>
                  </td>
                  <td>{a.errorCodes[error.code]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section class="doc__section" id="limity" aria-labelledby="h-limity">
          <h2 id="h-limity">{a.sections.limits}</h2>
          <p>{a.limitsIntro}</p>
          <table class="table">
            <thead>
              <tr>
                <th scope="col">{a.route}</th>
                <th scope="col">{a.limit}</th>
              </tr>
            </thead>
            <tbody>
              {LIMIT_ROUTES.map((route, i) => (
                <tr>
                  <td>
                    <code>{route}</code>
                  </td>
                  <td>{a.limits[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section class="doc__section" id="cors" aria-labelledby="h-cors">
          <h2 id="h-cors">{a.sections.cors}</h2>
          <ul>
            {a.cors.map((item) => (
              <li>{item}</li>
            ))}
          </ul>
        </section>

        <section class="doc__section" id="przyklady" aria-labelledby="h-przyklady">
          <h2 id="h-przyklady">{a.sections.examples}</h2>
          <h3 class="doc__subtitle">{ex.create}</h3>
          <Code>{createExample}</Code>
          <p>{ex.response}</p>
          <Code>{createResponse}</Code>
          <h3 class="doc__subtitle">{ex.stats}</h3>
          <Code>{statsExample}</Code>
          <h3 class="doc__subtitle">{ex.delete}</h3>
          <Code>{deleteExample}</Code>
          <p>{ex.partial}</p>
        </section>

        <section class="doc__section" id="migracja" aria-labelledby="h-migracja">
          <h2 id="h-migracja">{a.sections.migration}</h2>
          <p>{a.migration.intro}</p>
          <table class="table">
            <thead>
              <tr>
                <th scope="col">{a.migration.v2}</th>
                <th scope="col">{a.migration.v1}</th>
                <th scope="col">{a.migration.changes}</th>
              </tr>
            </thead>
            <tbody>
              {MIGRATION.map((row, i) => (
                <tr>
                  <td>
                    <code>{row.v2}</code>
                  </td>
                  <td>
                    <code>{row.v3}</code>
                  </td>
                  <td>{a.migration.rows[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul>
            <li>{a.migration.errors}</li>
          </ul>
        </section>
      </article>
    </Layout>
  );
}
