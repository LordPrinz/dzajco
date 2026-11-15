import { Header } from "./Header";
import { Layout } from "./Layout";
import { usePage } from "./page-context";
import type { PageText } from "./text";

export type NoticeKind = Exclude<keyof PageText["notices"], "back">;

export interface NoticeProps {
  nonce: string;
  kind: NoticeKind;
}

/** A plain page for errors and refusals (403, 404, 415, 429, 500) that a browser shows. */
export function Notice({ nonce, kind }: NoticeProps) {
  const { t } = usePage();
  const { title, message } = t.notices[kind];
  return (
    <Layout nonce={nonce} title={title}>
      <Header />
      <section class="result">
        <h2 class="result__title">{title}</h2>
        <p>{message}</p>
        <div class="result__actions">
          <a class="button" href="/">
            {t.notices.back}
          </a>
        </div>
      </section>
    </Layout>
  );
}
