import { Layout } from "./Layout";

export type LinkErrorKind = "not_found" | "expired" | "disabled";

const TEXT: Record<LinkErrorKind, { title: string; message: string }> = {
  not_found: {
    title: "Nie znaleziono linku",
    message: "Taki krótki link nie istnieje albo został usunięty.",
  },
  expired: {
    title: "Ten link wygasł",
    message: "Ten link miał ustawioną datę wygaśnięcia, która już minęła.",
  },
  disabled: {
    title: "Ten link został wyłączony",
    message: "Link prowadził do adresu zablokowanego z powodu nadużycia.",
  },
};

export interface LinkErrorProps {
  nonce: string;
  kind: LinkErrorKind;
  /** `mailto:` link from `ABUSE_EMAIL`, or null when none is configured. */
  reportHref: string | null;
}

/** The 404 and 410 page of the redirect route. No script; the abuse link is the only dynamic part. */
export function LinkError({ nonce, kind, reportHref }: LinkErrorProps) {
  const { title, message } = TEXT[kind];
  return (
    <Layout nonce={nonce} title={title} styles={["pages.css"]}>
      <section class="result result--center">
        <h1 class="result__title">{title}</h1>
        <p>{message}</p>
        <div class="result__actions">
          {reportHref !== null && (
            <a class="button button--ghost" href={reportHref}>
              Zgłoś nadużycie
            </a>
          )}
          <a class="button" href="/">
            Skróć własny link
          </a>
        </div>
      </section>
    </Layout>
  );
}
