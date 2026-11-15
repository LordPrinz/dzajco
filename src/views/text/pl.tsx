import type { Child } from "hono/jsx";
import { pl as common } from "../../shared/text/pl";
import type { ApiText } from "./api";

const api: ApiText = {
  title: "API",
  heading: "API dzajco v1",
  lead: (origin) => (
    <>
      Publiczne API JSON do tworzenia, odczytu i usuwania linków. Adres bazowy:{" "}
      <code>{origin}</code>.
    </>
  ),
  toc: "Spis treści",
  sections: {
    endpoints: "Endpointy",
    errors: "Błędy",
    limits: "Limity",
    cors: "CORS, klucz i nagłówki",
    corsShort: "CORS i klucz",
    examples: "Przykłady",
    migration: "Migracja z v2",
  },
  input: "Wejście.",
  status: "Status",
  body: "Treść",
  responses: "Odpowiedzi",
  code: "Kod",
  meaning: "Znaczenie",
  route: "Trasa",
  limit: "Limit",
  errorShape: "Każdy błąd ma ten sam kształt:",
  endpoints: {
    create: {
      summary: "Tworzy link. Wymaga nagłówka Content-Type: application/json.",
      input: "JSON: url (wymagane), customName (opcjonalne), expiresAt (ISO 8601 lub null).",
      responses: {
        201: "{ id, shortUrl, url, secretKey, expiresAt }. url to adres docelowy po normalizacji (host w punycode).",
        400: "invalid_json, invalid_body albo kod domenowy z tabeli poniżej.",
        409: "id_taken",
        413: "payload_too_large (ciało większe niż 8 KB)",
        415: "unsupported_media_type",
        429: "rate_limited",
        503: "service_unavailable",
      },
    },
    get: {
      summary: "Zwraca adres docelowy linku bez przekierowania.",
      input: "Brak.",
      responses: {
        200: "{ id, url, expiresAt, createdAt }",
        404: "not_found",
        410: "expired albo link_disabled",
        429: "rate_limited",
      },
    },
    stats: {
      summary:
        "Statystyki linku. Bez nagłówka Authorization widok publiczny, z poprawnym kluczem widok właściciela.",
      input: "Opcjonalnie Authorization: Bearer <klucz>.",
      responses: {
        200: "{ visits, countries: [{ code, visits }], partial }. Z kluczem dodatkowo cities.",
        403: "forbidden. Dotyczy każdego nagłówka Authorization, który nie jest poprawnym kluczem tego linku. Nie ma powrotu do widoku publicznego.",
        404: "not_found",
        410: "expired albo link_disabled",
        429: "rate_limited",
      },
    },
    delete: {
      summary:
        "Usuwa link i jego statystyki z serwisu. Podsumowanie trafia na 30 dni do wewnętrznego archiwum (zob. polityka prywatności).",
      input: "Authorization: Bearer <klucz>. Ciało jest ignorowane.",
      responses: {
        204: "Bez treści.",
        400: "invalid_key (brak klucza albo zły format)",
        403: "forbidden (klucz nie pasuje do linku)",
        404: "not_found",
        429: "rate_limited",
      },
    },
    globalStats: {
      summary: "Statystyki całego serwisu. Liczby obejmują tylko aktywne linki.",
      input: "Brak.",
      responses: {
        200: "{ links, visits, countries: [{ code, visits }], updatedAt }. Liczby przelicza się raz na dobę i mogą się spóźniać o około 24 godziny.",
        429: "rate_limited",
      },
    },
  },
  errorCodes: {
    invalid_json: "Ciało żądania nie jest poprawnym JSON-em.",
    invalid_body: "Ciało nie pasuje do schematu: brak url, pole o złym typie albo nieznane pole.",
    invalid_url: "url nie jest poprawnym adresem URL.",
    unsupported_scheme: "Dozwolone są tylko http: i https:.",
    url_too_long: "url ma więcej niż 2048 znaków.",
    credentials_not_allowed: "Adres zawiera dane logowania (user:hasło@).",
    own_host: "Adres prowadzi do tego serwisu.",
    private_target: "Adres lokalny, prywatny lub zastrzeżony (IPv4, IPv6, localhost).",
    blocked_target: "Adres jest innym skracaczem linków albo znajduje się na liście zablokowanych.",
    invalid_name:
      "customName ma mieć 3 do 32 liter, cyfr, znaków _ lub -. Nazwa jest zapisywana w postaci NFKC, więc pełnoszerokie litery stają się zwykłymi.",
    name_too_long: "customName jest za długie.",
    reserved_name: "customName jest zarezerwowane przez serwis.",
    mixed_script: "customName miesza alfabet łaciński z innym pismem lub cyframi innego pisma.",
    invalid_expiry: "expiresAt nie jest istniejącą datą w formacie ISO 8601.",
    expiry_in_past: "expiresAt jest w przeszłości.",
    expiry_too_far: "expiresAt jest dalej niż rok od teraz.",
    invalid_key: "DELETE bez klucza albo z kluczem w złym formacie.",
    forbidden: "Klucz nie pasuje do linku.",
    not_found: "Taki link nie istnieje.",
    id_taken: "customName jest już zajęte.",
    expired: "Link wygasł.",
    link_disabled: "Link został wyłączony z powodu nadużycia.",
    payload_too_large: "Ciało żądania ma więcej niż 8 KB.",
    unsupported_media_type: "Content-Type musi być application/json.",
    rate_limited: "Przekroczony limit żądań. Zobacz Retry-After.",
    internal_error: "Błąd serwera.",
    service_unavailable:
      "Sprawdzenie listy zablokowanych adresów nie powiodło się. Spróbuj później.",
  },
  limitsIntro: (
    <>
      Limity liczone są osobno dla każdego adresu IP w oknie 60 sekund. Po przekroczeniu dostajesz
      429 z nagłówkiem <code>Retry-After</code>. Limity działają w każdej lokalizacji osobno, więc
      to ochrona przed nadużyciem, nie dokładny licznik.
    </>
  ),
  limits: [
    "10 na minutę",
    "10 na minutę",
    "120 na minutę, wspólny z przekierowaniami GET /:id",
    "60 na minutę",
  ],
  cors: [
    <>
      Odpowiedzi <code>GET</code> mają <code>Access-Control-Allow-Origin: *</code>. Serwer nigdy nie
      odbija nagłówka <code>Origin</code> i nie zezwala na dane uwierzytelniające.
    </>,
    <>
      <code>POST</code> i <code>DELETE</code> nie mają CORS. Wywołuj je z serwera albo z tej samej
      domeny.
    </>,
    <>
      Klucz (<code>secretKey</code>) dostajesz raz, w odpowiedzi 201. Ma 22 znaki (base64url).
      Klucze linków przeniesionych z v2 mają 12 znaków (A-Z, a-z, 0-9, _, -) i działają tak samo.
      Wysyłaj go jako <code>Authorization: Bearer &lt;klucz&gt;</code> (nazwa schematu bez
      rozróżniania wielkości liter). Nigdy w adresie ani w zapytaniu.
    </>,
    <>
      Każdy link ma własny klucz. Odpowiedź 201, odpowiedź ze statystykami właściciela i strona
      wyniku mają <code>Cache-Control: no-store</code>.
    </>,
    <>
      Odpowiedzi JSON mają <code>Content-Security-Policy: default-src 'none'</code>.
    </>,
  ],
  examples: {
    create: "Utworzenie linku",
    response: "Odpowiedź 201:",
    stats: "Statystyki publiczne i właściciela",
    delete: "Usunięcie linku",
    key: "klucz",
    longPath: "dlugi/adres",
    name: "moj-link",
    keySample: "22 znaki",
    partial: (
      <>
        Pole <code>partial</code> w statystykach ma wartość <code>true</code>, gdy najnowszych wejść
        nie udało się odczytać. Dane z poprzednich dób są wtedy kompletne.
      </>
    ),
  },
  migration: {
    intro: (
      <>
        Stare adresy <code>/api/urls</code> nie mają aliasu. Adres <code>/dzajapi</code>{" "}
        przekierowuje (301) tutaj. Zmień wywołania według tabeli.
      </>
    ),
    v2: "Endpoint w v2",
    v1: "Endpoint w v1",
    changes: "Co się zmieniło",
    rows: [
      "Odpowiedź { id, url, expiresAt, createdAt } zamiast { fullLink }.",
      "Odpowiedź { visits, countries, partial }. Miasta (cities) tylko z kluczem. Strona /:id/info przekierowuje (301) na /:id/stats.",
      "Pole expire to teraz expiresAt (ISO 8601 lub null). Odpowiedź 201: { id, shortUrl, url, secretKey, expiresAt }, bez message. Błędy walidacji mają status 400 zamiast 422, zajęta nazwa 409. Wymagany Content-Type: application/json.",
      "Klucz idzie w nagłówku Authorization: Bearer <klucz>, nie w ciele { secretKey } i nigdy w adresie. Sukces to 204 bez treści.",
    ],
    errors: (
      <>
        Błędy mają postać <code>{"{ error: { code, message } }"}</code> zamiast{" "}
        <code>{'{ error: "..." }'}</code>. Rozpoznawaj je po <code>code</code>.
      </>
    ),
  },
};

export const pl = {
  common,
  meta: {
    description:
      "Darmowy skracacz linków od Dzajlopment. Własne nazwy, data wygaśnięcia i licznik wejść.",
    locale: "pl_PL",
  },
  nav: {
    home: "Strona główna",
    about: "O nas",
    history: "Historia",
    api: "API",
    privacy: "Prywatność",
    footer: "Nawigacja w stopce",
    skip: "Przejdź do treści",
  },
  settings: {
    theme: "Motyw",
    system: "Motyw systemowy",
    light: "Jasny motyw",
    dark: "Ciemny motyw",
    language: "Język",
  },
  hero: { subtitle: "Najlepszy skracacz linków w internecie." },
  home: {
    urlLabel: "Link do skrócenia",
    urlPlaceholder: "Link",
    submit: "Dżajcuj",
    moreOptions: "Więcej opcji",
    customName: "Własna nazwa",
    expiry: "Wygasa",
    customDateLabel: "Własna data wygaśnięcia (UTC)",
    customDateHint: "Czas UTC. Używana tylko przy wyborze „Własna data”.",
    lookupTitle: "Statystyki linku",
    lookupLabel: "Skrócony link lub jego kod",
    lookupPlaceholder: "Link lub kod",
    lookupSubmit: "Pokaż statystyki",
  },
  result: {
    title: "Twój link jest gotowy",
    shortLink: "Krótki link",
    target: "Prowadzi do:",
    idn: (host: Child) => (
      <>
        Adres docelowy używa znaków międzynarodowych. Faktyczna domena (punycode): {host}. Sprawdź,
        czy to na pewno ta strona.
      </>
    ),
    expires: "Wygasa:",
    keyTitle: "Zapisz klucz",
    keyText:
      "Poniższy klucz pozwala usunąć link i zobaczyć jego pełne statystyki. Zapisz go, nie pokażemy go ponownie.",
    stats: "Statystyki",
    another: "Skróć kolejny link",
    share: "Udostępnij",
  },
  created: { title: "Link utworzony" },
  notices: {
    back: "Wróć do formularza",
    error: { title: "Coś poszło nie tak", message: "Spróbuj ponownie za chwilę." },
    forbidden: {
      title: "Odrzucono żądanie",
      message: "Formularz można wysłać tylko z tej strony.",
    },
    rateLimited: {
      title: "Za dużo żądań",
      message: "Utworzono za dużo linków w krótkim czasie. Spróbuj ponownie za minutę.",
    },
    unsupported: { title: "Nieobsługiwany format", message: "Wyślij formularz z tej strony." },
    tooLarge: {
      title: "Formularz jest za duży",
      message: "Skróć dane w formularzu i spróbuj ponownie.",
    },
    notFound: { title: "Nie znaleziono strony", message: "Taka strona nie istnieje." },
  },
  linkError: {
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
    report: "Zgłoś nadużycie",
    shortenOwn: "Skróć własny link",
    cta: "Zrób własny krótki link jednym kliknięciem:",
  },
  history: {
    title: "Historia",
    heading: "Historia linków",
    lead: "Linki utworzone albo dodane w tej przeglądarce. Lista jest zapisana tylko tutaj, na Twoim urządzeniu.",
    noscript: "Historia wymaga włączonego JavaScriptu.",
    empty: "Brak zapisanych linków.",
    emptyLink: "Skróć pierwszy link",
    note: "Usunąć można tylko linki zapisane razem z kluczem. Wpisy bez klucza są tylko do odczytu.",
    add: {
      heading: "Dodaj link z kluczem",
      lead: "Link utworzony na innym urządzeniu? Wklej go z kluczem do zarządzania. Sprawdzimy klucz i zapiszemy link w tej przeglądarce.",
      codeLabel: "Krótki link albo kod",
      keyLabel: "Klucz do zarządzania",
      submit: "Dodaj link",
    },
  },
  stats: {
    title: (id: string) => `Statystyki ${id}`,
    heading: "Statystyki linku",
    visits: "Wejścia",
    countries: "Kraje",
    noVisits: "Brak wejść",
    partial: "Najnowsze wejścia mogą jeszcze nie być widoczne.",
    cities: "Miasta",
    noCities: "Brak danych o miastach",
    showMap: "Pokaż mapę",
    map: "Mapa wejść",
    created: "Utworzono:",
    expires: "Wygasa:",
    never: "nigdy",
    noClicks: "Nie ma jeszcze kliknięć",
    noClicksHint: "Udostępnij link i zajrzyj tu później.",
    ownerHint:
      "Miasta i mapa są widoczne tylko w przeglądarce, która ma klucz tego linku w Historii. Na innym urządzeniu dodaj link z kluczem na stronie Historia.",
  },
  about: {
    title: "O nas",
    heading: (brand: Child) => <>Dlaczego {brand}</>,
    lead: "Prosty i szybki skracacz linków. Ma robić jedno: z długiego adresu zrobić krótki, który działa tak długo, jak tego chcesz.",
    features: {
      login: {
        title: "Bez logowania",
        text: "Żadnych kont. Skracasz link od razu, bez zakładania profilu.",
      },
      expiry: {
        title: "Data wygaśnięcia",
        text: "Ustaw, kiedy link ma przestać działać. Dobre do promocji i tymczasowych udostępnień.",
      },
      name: {
        title: "Własne nazwy",
        text: "Nadaj linkowi własną nazwę albo pozwól wygenerować krótki, unikalny identyfikator.",
      },
      delete: {
        title: "Ręczne usuwanie",
        text: "Kluczem z momentu utworzenia usuniesz link, kiedy tylko zechcesz.",
      },
      visitors: {
        title: "Licznik wejść",
        text: "Zobacz, ile razy link został otwarty i z jakich krajów. Pełne dane, z miastami, widzi właściciel klucza.",
      },
      history: {
        title: "Historia",
        text: "Linki z tej przeglądarki wracają na liście, żeby łatwo je skopiować lub usunąć.",
      },
    },
    numbers: "Serwis w liczbach",
    notYet: "Statystyki pojawią się po pierwszym codziennym przeliczeniu.",
    links: "Aktywnych linków",
    visits: "Wejść w aktywnych linkach",
    topCountries: "Kraje z największą liczbą wejść",
    updated: "Zaktualizowano:",
    liveOnly:
      "Usunięte i wygasłe linki nie wchodzą do tych liczb, a razem z nimi znikają ich wejścia.",
    daily: "Liczby przelicza się raz na dobę, więc mogą się spóźniać nawet o około 24 godziny.",
    support: "Wesprzyj projekt",
    supportText: "Dzajco jest darmowe. Jeśli Ci się przydaje, możesz wesprzeć rozwój projektu.",
    sponsor: "Wesprzyj LordPrinz na GitHub Sponsors",
  },
  privacy: {
    title: "Polityka prywatności",
    updated: "15.11.2026",
    lead: (date: Child) => (
      <>
        Ostatnia aktualizacja: {date}. Zbieramy tyle danych, ile potrzeba, żeby link działał i żeby
        pokazać, skąd wchodzą odwiedzający.
      </>
    ),
    stored: {
      heading: "Co przechowujemy",
      items: [
        <>
          <strong>Linki.</strong> Krótką nazwę, adres docelowy, datę utworzenia i datę wygaśnięcia.
          Link wygasły jest usuwany.
        </>,
        <>
          <strong>Archiwum usuniętych linków.</strong> Link usunięty przez właściciela trafia na 30
          dni do wewnętrznego archiwum: adres docelowy, daty i łączne liczby wejść, bez klucza.
          Widzi je tylko operator serwisu, a po 30 dniach wpis jest usuwany.
        </>,
        <>
          <strong>Klucze do usuwania w postaci skrótu.</strong> Klucz pokazujemy raz, przy
          utworzeniu linku. Zapisujemy wyłącznie jego skrót kryptograficzny (HMAC), więc nie
          potrafimy go odtworzyć ani Ci go przypomnieć.
        </>,
        <>
          <strong>Zagregowane liczniki wejść.</strong> Dla każdego linku liczbę wejść z podziałem na
          kraj i miasto. Kraj i miasto pochodzą z danych, które Cloudflare dołącza do żądania.
          Liczniki nie wskazują pojedynczej osoby i zostają w bazie danych, dopóki istnieje link.
        </>,
        <>
          <strong>Zdarzenia wejść.</strong> Każde wejście w link jest zapisywane w Cloudflare
          Analytics Engine jako zdarzenie: czas, identyfikator linku, kraj, miasto i przybliżone
          współrzędne. Nie zapisujemy adresu IP ani nagłówka User-Agent. Zdarzenia są przechowywane
          do 3 miesięcy, a potem zostają tylko zagregowane liczniki z bazy danych.
        </>,
      ],
    },
    ip: {
      heading: "Adresy IP",
      text: "Adresy IP klientów występują tylko w logach samego Cloudflare, które działa jako nasz dostawca infrastruktury. Nasza aplikacja nie zapisuje ich w bazie ani we własnych logach. Adres IP służy jej wyłącznie do chwilowego limitowania liczby żądań i nie jest przechowywany.",
    },
    analytics: {
      heading: "Statystyki odwiedzin serwisu",
      text: "Używamy Cloudflare Web Analytics bez plików cookie. Mierzy ona odsłony stron serwisu w zbiorczej postaci, bez śledzenia między witrynami i bez profilowania.",
    },
    local: {
      heading: "Historia w przeglądarce",
      text: (
        <>
          Lista Twoich linków, razem z kluczami do ich usuwania, jest zapisana w pamięci lokalnej
          przeglądarki (localStorage, klucz <code>links-history</code>). Mieszka tylko na Twoim
          urządzeniu i nie trafia na nasz serwer. Wyczyszczenie danych przeglądarki usuwa ją
          bezpowrotnie. Do usunięcia linku i zobaczenia miast potrzebny jest klucz. Zapisz go
          osobno, jeśli chcesz mieć dostęp z innego urządzenia: tam dodasz link z kluczem na stronie
          Historia. Gdy usuwasz link, oglądasz jego miasta albo go dodajesz, klucz trafia na serwer
          tylko w nagłówku, do sprawdzenia; lista zostaje w tej przeglądarce.
        </>
      ),
    },
    cookies: {
      heading: "Pliki cookie",
      text: (
        <>
          Serwis ustawia dwa pliki cookie i tylko wtedy, gdy użyjesz przełączników w nagłówku:{" "}
          <code>theme</code> zapamiętuje jasny albo ciemny motyw, a <code>lang</code> wybrany język.
          Każdy działa przez rok i nie służy do śledzenia. Powrót do motywu systemowego usuwa{" "}
          <code>theme</code>.
        </>
      ),
    },
    map: {
      heading: "Mapa na stronie statystyk",
      text: "Mapa miast w statystykach właściciela linku pobiera kafelki z OpenStreetMap (tile.openstreetmap.org). Przeglądarka wysyła wtedy do OpenStreetMap swój adres IP i fragment mapy, który wyświetla, ale nie adres linku. Mapa ładuje się dopiero po jej otwarciu.",
    },
    contact: {
      heading: "Kontakt",
      withLink: (link: Child) => <>Pytania o dane i zgłoszenia nadużyć: {link}.</>,
      linkText: "napisz do nas",
      withoutLink: "Pytania o dane i zgłoszenia nadużyć kieruj do administratora serwisu.",
    },
  },
  api,
};

export type PageText = typeof pl;
