import { Layout } from "./Layout";
import { usePage } from "./page-context";

export type LinkErrorKind = "not_found" | "expired" | "disabled";

export interface LinkErrorProps {
  nonce: string;
  kind: LinkErrorKind;
  /** `mailto:` link from `ABUSE_EMAIL`, or null when none is configured. */
  reportHref: string | null;
}

/** The 404 and 410 page of the redirect route. No script; the abuse link is the only dynamic part. */
export function LinkError({ nonce, kind, reportHref }: LinkErrorProps) {
  const { t } = usePage();
  const { title, message } = t.linkError[kind];
  return (
    <Layout nonce={nonce} title={title} styles={["pages.css"]}>
      <section class="result result--center">
        <h1 class="result__title">{title}</h1>
        <p>{message}</p>
        <div class="result__actions">
          {reportHref !== null && (
            <a class="button button--ghost" href={reportHref}>
              {t.linkError.report}
            </a>
          )}
          <a class="button" href="/">
            {t.linkError.shortenOwn}
          </a>
        </div>
      </section>
    </Layout>
  );
}
