import { Header } from "./Header";
import { Layout } from "./Layout";
import { usePage } from "./page-context";
import { Shorten } from "./Shorten";

export type LinkErrorKind = "not_found" | "expired" | "disabled";

export interface LinkErrorProps {
  nonce: string;
  kind: LinkErrorKind;
  /** `mailto:` link from `ABUSE_EMAIL`, or null when none is configured. */
  reportHref: string | null;
}

/**
 * The 404 and 410 page of the redirect route. People land here from someone else's dead link, so the
 * page says what happened and offers the shorten form right away. "Report abuse" shows only for a
 * disabled link: there is nothing to report about a link that does not exist or ran out.
 */
export function LinkError({ nonce, kind, reportHref }: LinkErrorProps) {
  const { t } = usePage();
  const { title, message } = t.linkError[kind];
  return (
    <Layout nonce={nonce} title={title} scripts={["form.js"]} styles={["pages.css"]}>
      <Header />
      <section class="dead-link" aria-labelledby="dead-link-title" data-hide-on-result>
        <h2 class="dead-link__title" id="dead-link-title">
          {title}
        </h2>
        <p class="dead-link__message">{message}</p>
        {kind === "disabled" && reportHref !== null && (
          <p class="dead-link__report">
            <a href={reportHref}>{t.linkError.report}</a>
          </p>
        )}
        <p class="dead-link__cta">{t.linkError.cta}</p>
      </section>
      <Shorten />
    </Layout>
  );
}
