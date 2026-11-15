import { Layout } from "./Layout";
import { usePage } from "./page-context";

export interface PrivacyProps {
  nonce: string;
  /** `mailto:` link from `ABUSE_EMAIL`, or null when none is configured. */
  contactHref: string | null;
}

export const PRIVACY_UPDATED = "2026-11-15";

export function Privacy({ nonce, contactHref }: PrivacyProps) {
  const { t } = usePage();
  const p = t.privacy;
  return (
    <Layout nonce={nonce} title={p.title} styles={["pages.css"]}>
      <article class="doc">
        <h1 class="doc__title">{p.title}</h1>
        <p class="doc__lead">{p.lead(<time datetime={PRIVACY_UPDATED}>{p.updated}</time>)}</p>

        <section class="doc__section" aria-labelledby="p-stored">
          <h2 id="p-stored">{p.stored.heading}</h2>
          <ul>
            {p.stored.items.map((item) => (
              <li>{item}</li>
            ))}
          </ul>
        </section>

        <section class="doc__section" aria-labelledby="p-ip">
          <h2 id="p-ip">{p.ip.heading}</h2>
          <p>{p.ip.text}</p>
        </section>

        <section class="doc__section" aria-labelledby="p-analytics">
          <h2 id="p-analytics">{p.analytics.heading}</h2>
          <p>{p.analytics.text}</p>
        </section>

        <section class="doc__section" aria-labelledby="p-local">
          <h2 id="p-local">{p.local.heading}</h2>
          <p>{p.local.text}</p>
        </section>

        <section class="doc__section" aria-labelledby="p-cookies">
          <h2 id="p-cookies">{p.cookies.heading}</h2>
          <p>{p.cookies.text}</p>
        </section>

        <section class="doc__section" aria-labelledby="p-map">
          <h2 id="p-map">{p.map.heading}</h2>
          <p>{p.map.text}</p>
        </section>

        <section class="doc__section" aria-labelledby="p-contact">
          <h2 id="p-contact">{p.contact.heading}</h2>
          <p>
            {contactHref
              ? p.contact.withLink(<a href={contactHref}>{p.contact.linkText}</a>)
              : p.contact.withoutLink}
          </p>
        </section>
      </article>
    </Layout>
  );
}
