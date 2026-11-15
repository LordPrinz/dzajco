import { usePage } from "./page-context";

export function Header() {
  const { t } = usePage();
  return (
    <header class="hero">
      <h1 class="hero__title">
        <img class="hero__logo" src="/img/logo.svg" alt="" width="56" height="56" />
        dzajco
      </h1>
      <p class="hero__subtitle">{t.hero.subtitle}</p>
    </header>
  );
}
