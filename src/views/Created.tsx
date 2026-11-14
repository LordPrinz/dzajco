import type { CreateLinkResult } from "../services/links";
import { Header } from "./Header";
import { Layout } from "./Layout";
import { ResultCard } from "./ResultCard";

type Created = Extract<CreateLinkResult, { ok: true }>;

function formatExpiry(iso: string | null): string | null {
  if (iso === null) return null;
  return `${new Date(iso).toLocaleString("pl-PL", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  })} UTC`;
}

export function Created({ nonce, link }: { nonce: string; link: Created }) {
  return (
    <Layout nonce={nonce} title="Link utworzony" scripts={["form.js"]}>
      <Header />
      <ResultCard
        id={link.id}
        shortUrl={link.shortUrl}
        target={link.target}
        secretKey={link.secretKey}
        host={link.host}
        isIdn={link.isIdn}
        expiresAt={link.expiresAt}
        expiresLabel={formatExpiry(link.expiresAt)}
      />
    </Layout>
  );
}
