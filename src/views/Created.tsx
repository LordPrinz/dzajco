import type { CreateLinkResult } from "../services/links";
import { type Lang, LOCALE } from "../shared/lang";
import { Header } from "./Header";
import { Layout } from "./Layout";
import { usePage } from "./page-context";
import { ResultCard } from "./ResultCard";

type Created = Extract<CreateLinkResult, { ok: true }>;

function formatExpiry(iso: string | null, lang: Lang): string | null {
  if (iso === null) return null;
  return `${new Date(iso).toLocaleString(LOCALE[lang], {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  })} UTC`;
}

export function Created({ nonce, link }: { nonce: string; link: Created }) {
  const { lang, t } = usePage();
  return (
    <Layout nonce={nonce} title={t.created.title} scripts={["form.js"]} settings={false}>
      <Header />
      <ResultCard
        id={link.id}
        shortUrl={link.shortUrl}
        target={link.target}
        secretKey={link.secretKey}
        host={link.host}
        isIdn={link.isIdn}
        expiresAt={link.expiresAt}
        expiresLabel={formatExpiry(link.expiresAt, lang)}
      />
    </Layout>
  );
}
