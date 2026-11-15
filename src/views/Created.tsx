import type { CreateLinkResult } from "../services/links";
import { formatUtc } from "./format";
import { Header } from "./Header";
import { Layout } from "./Layout";
import { usePage } from "./page-context";
import { ResultCard } from "./ResultCard";

type Created = Extract<CreateLinkResult, { ok: true }>;

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
        expiresLabel={link.expiresAt === null ? null : formatUtc(link.expiresAt, lang)}
      />
    </Layout>
  );
}
