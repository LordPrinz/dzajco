import { Header } from "./Header";
import { Layout } from "./Layout";

export interface NoticeProps {
  nonce: string;
  title: string;
  message: string;
}

/** A plain page for refusals (403, 415, 429) that a browser shows after a form post. */
export function Notice({ nonce, title, message }: NoticeProps) {
  return (
    <Layout nonce={nonce} title={title}>
      <Header />
      <section class="result">
        <h2 class="result__title">{title}</h2>
        <p>{message}</p>
        <div class="result__actions">
          <a class="button" href="/">
            Wróć do formularza
          </a>
        </div>
      </section>
    </Layout>
  );
}
