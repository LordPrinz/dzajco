import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";

export type Lang = "en" | "pl";

/**
 * English is the source of truth: the Polish table is typed against it, so a
 * missing translation is a compile error rather than a blank label.
 */
const en = {
	"nav.home": "Home",
	"nav.about": "About",
	"nav.history": "My links",
	"nav.dashboard": "Dashboard",
	"nav.api": "API",
	"nav.privacy": "Privacy",
	"nav.login": "Sign in",
	"nav.logout": "Sign out",

	"home.tagline": "The best link shortener you were looking for.",
	"home.placeholder": "Paste a long link",
	"home.submit": "Dżajcuj",
	"home.more": "More options",
	"home.less": "Fewer options",
	"home.customName": "Custom name",
	"home.customNameHint":
		"2–32 characters: letters, digits, hyphens, underscores.",
	"home.title": "Label (private)",
	"home.titleHint": "Only you see it — helps you find the link later.",
	"home.password": "Password",
	"home.passwordHint": "Visitors must type this before the redirect.",
	"home.startsAt": "Active from",
	"home.startsAtHint": "Before this moment the link is not live yet.",
	"home.expiresAt": "Expires",
	"home.expiresAtHint": "After this moment the link stops working.",
	"home.maxClicks": "Click limit",
	"home.maxClicksHint": "The link retires after this many visits.",
	"home.utm": "Collect UTM parameters",
	"home.utmHint": "Break clicks down by campaign. Requires an account.",
	"home.utmLocked": "Sign in to unlock UTM reporting.",
	"home.statsHeading": "Link statistics",
	"home.statsPlaceholder": "Short link or code",
	"home.statsSubmit": "Show statistics",
	"home.autoNameNote":
		"Auto-generated names are 4–12 characters and skip look-alikes like l, I, 0 and O.",

	"result.ready": "Your link is ready",
	"result.copy": "Copy",
	"result.copied": "Copied",
	"result.secretTitle": "Your owner key",
	"result.secretBody":
		"This key proves the link is yours — it opens the full statistics and can delete the link. We store only a hash of it, so it cannot be recovered. It has been saved in this browser.",
	"result.secretCopy": "Copy key",
	"result.qr": "QR code",
	"result.download": "Download",
	"result.openStats": "Statistics",
	"result.another": "Shorten another",

	"qr.size": "Size",
	"qr.format": "Format",

	"stats.title": "Statistics",
	"stats.clicks": "Clicks",
	"stats.countries": "Countries",
	"stats.cities": "Cities",
	"stats.last7d": "Last 7 days",
	"stats.last30d": "Last 30 days",
	"stats.timeline": "Clicks over time",
	"stats.map": "Where the clicks came from",
	"stats.countriesMap": "Clicks by country",
	"stats.topCountries": "Top countries",
	"stats.topCities": "Top cities",
	"stats.referrers": "Referrers",
	"stats.devices": "Devices",
	"stats.browsers": "Browsers",
	"stats.utm": "Campaigns (UTM)",
	"stats.utmOff": "UTM collection is off for this link.",
	"stats.utmAnon": "UTM reporting is available on account-owned links.",
	"stats.noData": "No clicks yet.",
	"stats.publicNotice":
		"You are viewing the public summary. Enter the owner key to see cities, referrers, devices and the timeline.",
	"stats.unlock": "Unlock full statistics",
	"stats.keyPlaceholder": "Owner key",
	"stats.export": "Export CSV",
	"stats.target": "Destination",
	"stats.created": "Created",
	"stats.expires": "Expires",
	"stats.starts": "Active from",
	"stats.lastClick": "Last click",
	"stats.direct": "Direct",
	"stats.visits_one": "visit",
	"stats.visits_other": "visits",

	"status.active": "Active",
	"status.scheduled": "Scheduled",
	"status.expired": "Expired",
	"status.disabled": "Disabled",
	"status.exhausted": "Limit reached",

	"gate.password.title": "This link is protected",
	"gate.password.body": "Enter the password to continue.",
	"gate.password.submit": "Open link",
	"gate.password.wrong": "Wrong password.",
	"gate.notFound.title": "No such link",
	"gate.notFound.body": "This short link does not exist, or it was deleted.",
	"gate.expired.title": "This link has expired",
	"gate.expired.body": "Its owner set an expiration date that has passed.",
	"gate.scheduled.title": "Not live yet",
	"gate.scheduled.body": "This link becomes active on {date}.",
	"gate.disabled.title": "Link disabled",
	"gate.disabled.body": "Its owner turned this link off.",
	"gate.exhausted.title": "Click limit reached",
	"gate.exhausted.body": "This link hit the number of visits its owner allowed.",
	"gate.home": "Go to homepage",

	"history.title": "My links",
	"history.subtitle":
		"Links you created in this browser. They are stored locally, together with the owner key for each one.",
	"history.empty": "Nothing here yet. Shorten a link and it will show up.",
	"history.export": "Export profile",
	"history.import": "Import profile",
	"history.imported": "Imported {count} link(s).",
	"history.importFailed": "That file could not be read.",
	"history.forget": "Forget",
	"history.delete": "Delete",
	"history.confirmDelete": "Delete this link for everyone? This cannot be undone.",
	"history.deleted": "Link deleted.",
	"history.gone": "Some saved links no longer exist on the server.",

	"dashboard.title": "Dashboard",
	"dashboard.empty": "You have not created any links with this account yet.",
	"dashboard.signedInAs": "Signed in as {name}",

	"login.title": "Sign in",
	"login.createTitle": "Create an account",
	"login.email": "E-mail",
	"login.password": "Password",
	"login.passwordHint": "At least 8 characters.",
	"login.submit": "Sign in",
	"login.createSubmit": "Create account",
	"login.toRegister": "No account yet? Create one",
	"login.toLogin": "Already have an account? Sign in",
	"login.or": "or",
	"login.body":
		"An account keeps your links in one place across devices and unlocks UTM campaign reporting.",
	"login.github": "Continue with GitHub",
	"login.google": "Continue with Google",
	"login.anon":
		"You do not need an account to shorten links — anonymous links are kept with an owner key instead.",
	"login.unavailable": "Sign-in is not configured on this deployment.",
	"login.error.state": "The sign-in attempt expired. Please try again.",
	"login.error.failed": "Sign-in failed. Please try again.",
	"login.error.cancelled": "Sign-in was cancelled.",

	"about.title": "About dzajco",
	"about.body":
		"A free link shortener. No account required, no tracking of the people who click your links beyond the country and city their network reports.",
	"about.links": "Links created",
	"about.clicks": "Clicks served",
	"about.topCountries": "Top countries",

	"error.generic": "Something went wrong. Try again.",
	"error.rate_limited": "Too many requests. Give it a minute.",
	"error.captcha_failed": "The bot check failed. Reload and try again.",
	"error.name_taken": "That name is already taken.",
	"error.url_invalid": "That does not look like a valid link.",
	"error.url_scheme": "Only http and https links can be shortened.",
	"error.url_private": "That address points at a private network.",
	"error.url_self": "That is already a dzajco link.",
	"error.url_too_long": "That link is too long.",
	"error.url_credentials": "Links with embedded credentials are not accepted.",
	"error.name_charset":
		"Custom names may use letters, digits, hyphens and underscores.",
	"error.name_reserved": "That name is reserved.",
	"error.name_blocked": "That name is not available.",
	"error.name_too_short": "Custom name is too short.",
	"error.name_too_long": "Custom name is too long.",
	"error.password_short": "Password is too short.",
	"error.expiry_too_soon": "The expiration date must be in the future.",
	"error.expiry_before_start": "The expiration must come after the start date.",
	"error.forbidden": "That owner key does not match this link.",
	"error.not_found": "Link not found.",
	"error.bad_login": "Wrong e-mail or password.",
	"error.email_taken": "That e-mail is already registered.",
	"error.bad_credentials":
		"Enter a valid e-mail and a password of at least 8 characters.",
	"error.auth_unconfigured": "Sign-in is not configured on this deployment.",

	"common.optional": "optional",
	"common.cancel": "Cancel",
	"common.close": "Close",
	"common.loading": "Loading…",
	"common.theme": "Theme",
	"common.language": "Language",
} as const;

export type MessageKey = keyof typeof en;

const pl: Record<MessageKey, string> = {
	"nav.home": "Start",
	"nav.about": "O nas",
	"nav.history": "Moje linki",
	"nav.dashboard": "Panel",
	"nav.api": "API",
	"nav.privacy": "Prywatność",
	"nav.login": "Zaloguj się",
	"nav.logout": "Wyloguj się",

	"home.tagline": "Najlepszy skracacz linków, jakiego szukałeś.",
	"home.placeholder": "Wklej długi link",
	"home.submit": "Dżajcuj",
	"home.more": "Więcej opcji",
	"home.less": "Mniej opcji",
	"home.customName": "Własna nazwa",
	"home.customNameHint": "2–32 znaki: litery, cyfry, myślniki, podkreślenia.",
	"home.title": "Etykieta (prywatna)",
	"home.titleHint": "Widzisz ją tylko Ty — ułatwia odnalezienie linku.",
	"home.password": "Hasło",
	"home.passwordHint": "Odwiedzający musi je podać przed przekierowaniem.",
	"home.startsAt": "Aktywny od",
	"home.startsAtHint": "Przed tym momentem link jeszcze nie działa.",
	"home.expiresAt": "Wygasa",
	"home.expiresAtHint": "Po tym momencie link przestaje działać.",
	"home.maxClicks": "Limit kliknięć",
	"home.maxClicksHint": "Link wyłącza się po tylu wejściach.",
	"home.utm": "Zbieraj parametry UTM",
	"home.utmHint": "Rozbicie kliknięć na kampanie. Wymaga konta.",
	"home.utmLocked": "Zaloguj się, aby odblokować raporty UTM.",
	"home.statsHeading": "Statystyki linku",
	"home.statsPlaceholder": "Krótki link lub kod",
	"home.statsSubmit": "Pokaż statystyki",
	"home.autoNameNote":
		"Nazwy generowane automatycznie mają 4–12 znaków i pomijają mylące l, I, 0 i O.",

	"result.ready": "Twój link jest gotowy",
	"result.copy": "Kopiuj",
	"result.copied": "Skopiowano",
	"result.secretTitle": "Twój klucz właściciela",
	"result.secretBody":
		"Ten klucz potwierdza, że link należy do Ciebie — otwiera pełne statystyki i pozwala go usunąć. Przechowujemy tylko jego skrót, więc nie da się go odzyskać. Zapisaliśmy go w tej przeglądarce.",
	"result.secretCopy": "Kopiuj klucz",
	"result.qr": "Kod QR",
	"result.download": "Pobierz",
	"result.openStats": "Statystyki",
	"result.another": "Skróć kolejny",

	"qr.size": "Rozmiar",
	"qr.format": "Format",

	"stats.title": "Statystyki",
	"stats.clicks": "Kliknięcia",
	"stats.countries": "Kraje",
	"stats.cities": "Miejscowości",
	"stats.last7d": "Ostatnie 7 dni",
	"stats.last30d": "Ostatnie 30 dni",
	"stats.timeline": "Kliknięcia w czasie",
	"stats.map": "Skąd pochodziły kliknięcia",
	"stats.countriesMap": "Kliknięcia według krajów",
	"stats.topCountries": "Najczęstsze kraje",
	"stats.topCities": "Najczęstsze miejscowości",
	"stats.referrers": "Źródła wejść",
	"stats.devices": "Urządzenia",
	"stats.browsers": "Przeglądarki",
	"stats.utm": "Kampanie (UTM)",
	"stats.utmOff": "Zbieranie UTM jest wyłączone dla tego linku.",
	"stats.utmAnon": "Raporty UTM są dostępne dla linków przypisanych do konta.",
	"stats.noData": "Brak kliknięć.",
	"stats.publicNotice":
		"Oglądasz podsumowanie publiczne. Podaj klucz właściciela, aby zobaczyć miejscowości, źródła wejść, urządzenia i oś czasu.",
	"stats.unlock": "Odblokuj pełne statystyki",
	"stats.keyPlaceholder": "Klucz właściciela",
	"stats.export": "Eksport CSV",
	"stats.target": "Cel",
	"stats.created": "Utworzono",
	"stats.expires": "Wygasa",
	"stats.starts": "Aktywny od",
	"stats.lastClick": "Ostatnie kliknięcie",
	"stats.direct": "Bezpośrednie",
	"stats.visits_one": "wejście",
	"stats.visits_other": "wejść",

	"status.active": "Aktywny",
	"status.scheduled": "Zaplanowany",
	"status.expired": "Wygasł",
	"status.disabled": "Wyłączony",
	"status.exhausted": "Limit osiągnięty",

	"gate.password.title": "Ten link jest chroniony",
	"gate.password.body": "Podaj hasło, aby kontynuować.",
	"gate.password.submit": "Otwórz link",
	"gate.password.wrong": "Błędne hasło.",
	"gate.notFound.title": "Nie ma takiego linku",
	"gate.notFound.body": "Ten krótki link nie istnieje lub został usunięty.",
	"gate.expired.title": "Link wygasł",
	"gate.expired.body": "Właściciel ustawił datę wygaśnięcia, która już minęła.",
	"gate.scheduled.title": "Jeszcze nieaktywny",
	"gate.scheduled.body": "Ten link stanie się aktywny {date}.",
	"gate.disabled.title": "Link wyłączony",
	"gate.disabled.body": "Właściciel wyłączył ten link.",
	"gate.exhausted.title": "Limit kliknięć osiągnięty",
	"gate.exhausted.body":
		"Ten link osiągnął liczbę wejść dozwoloną przez właściciela.",
	"gate.home": "Przejdź na stronę główną",

	"history.title": "Moje linki",
	"history.subtitle":
		"Linki utworzone w tej przeglądarce. Są zapisane lokalnie razem z kluczem właściciela do każdego z nich.",
	"history.empty": "Jeszcze pusto. Skróć link, a pojawi się tutaj.",
	"history.export": "Eksportuj profil",
	"history.import": "Importuj profil",
	"history.imported": "Zaimportowano linki: {count}.",
	"history.importFailed": "Nie udało się odczytać tego pliku.",
	"history.forget": "Zapomnij",
	"history.delete": "Usuń",
	"history.confirmDelete":
		"Usunąć ten link dla wszystkich? Tej operacji nie można cofnąć.",
	"history.deleted": "Link usunięty.",
	"history.gone": "Część zapisanych linków już nie istnieje na serwerze.",

	"dashboard.title": "Panel",
	"dashboard.empty": "Nie utworzyłeś jeszcze żadnych linków na tym koncie.",
	"dashboard.signedInAs": "Zalogowano jako {name}",

	"login.title": "Zaloguj się",
	"login.createTitle": "Załóż konto",
	"login.email": "E-mail",
	"login.password": "Hasło",
	"login.passwordHint": "Co najmniej 8 znaków.",
	"login.submit": "Zaloguj się",
	"login.createSubmit": "Załóż konto",
	"login.toRegister": "Nie masz konta? Załóż je",
	"login.toLogin": "Masz już konto? Zaloguj się",
	"login.or": "lub",
	"login.body":
		"Konto trzyma Twoje linki w jednym miejscu na wszystkich urządzeniach i odblokowuje raporty kampanii UTM.",
	"login.github": "Kontynuuj przez GitHub",
	"login.google": "Kontynuuj przez Google",
	"login.anon":
		"Konto nie jest potrzebne do skracania linków — anonimowe linki chroni klucz właściciela.",
	"login.unavailable": "Logowanie nie jest skonfigurowane w tym wdrożeniu.",
	"login.error.state": "Próba logowania wygasła. Spróbuj ponownie.",
	"login.error.failed": "Logowanie nie powiodło się. Spróbuj ponownie.",
	"login.error.cancelled": "Logowanie zostało anulowane.",

	"about.title": "O dzajco",
	"about.body":
		"Darmowy skracacz linków. Bez konta i bez śledzenia osób klikających w Twoje linki poza krajem i miejscowością zgłaszaną przez ich sieć.",
	"about.links": "Utworzonych linków",
	"about.clicks": "Obsłużonych kliknięć",
	"about.topCountries": "Najczęstsze kraje",

	"error.generic": "Coś poszło nie tak. Spróbuj ponownie.",
	"error.rate_limited": "Zbyt wiele żądań. Odczekaj chwilę.",
	"error.captcha_failed":
		"Weryfikacja antybotowa nie powiodła się. Odśwież i spróbuj ponownie.",
	"error.name_taken": "Ta nazwa jest już zajęta.",
	"error.url_invalid": "To nie wygląda na poprawny link.",
	"error.url_scheme": "Skracać można tylko linki http i https.",
	"error.url_private": "Ten adres wskazuje na sieć prywatną.",
	"error.url_self": "To już jest link dzajco.",
	"error.url_too_long": "Ten link jest za długi.",
	"error.url_credentials": "Linki z wbudowanymi danymi logowania nie są przyjmowane.",
	"error.name_charset":
		"Własne nazwy mogą zawierać litery, cyfry, myślniki i podkreślenia.",
	"error.name_reserved": "Ta nazwa jest zarezerwowana.",
	"error.name_blocked": "Ta nazwa jest niedostępna.",
	"error.name_too_short": "Własna nazwa jest za krótka.",
	"error.name_too_long": "Własna nazwa jest za długa.",
	"error.password_short": "Hasło jest za krótkie.",
	"error.expiry_too_soon": "Data wygaśnięcia musi być w przyszłości.",
	"error.expiry_before_start": "Wygaśnięcie musi nastąpić po dacie startu.",
	"error.forbidden": "Ten klucz właściciela nie pasuje do tego linku.",
	"error.not_found": "Nie znaleziono linku.",
	"error.bad_login": "Błędny e-mail lub hasło.",
	"error.email_taken": "Ten e-mail jest już zarejestrowany.",
	"error.bad_credentials":
		"Podaj poprawny e-mail i hasło o długości co najmniej 8 znaków.",
	"error.auth_unconfigured": "Logowanie nie jest skonfigurowane w tym wdrożeniu.",

	"common.optional": "opcjonalne",
	"common.cancel": "Anuluj",
	"common.close": "Zamknij",
	"common.loading": "Wczytywanie…",
	"common.theme": "Motyw",
	"common.language": "Język",
};

const TABLES: Record<Lang, Record<MessageKey, string>> = { en, pl };

const STORAGE_KEY = "dzajco:lang";

function initialLang(): Lang {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === "pl" || saved === "en") return saved;
	} catch {
		// Storage unavailable; the default below still applies.
	}
	// English is the default interface language regardless of the browser's
	// locale; Polish is opt-in through the header toggle. The brand words
	// ("dzajco", "Dżajcuj") stay Polish in both.
	return "en";
}

export type Translate = (
	key: MessageKey,
	vars?: Record<string, string | number>
) => string;

type I18nValue = { lang: Lang; setLang: (lang: Lang) => void; t: Translate };

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
	const [lang, setLangState] = useState<Lang>(initialLang);

	useEffect(() => {
		document.documentElement.lang = lang;
	}, [lang]);

	const setLang = useCallback((next: Lang) => {
		setLangState(next);
		try {
			localStorage.setItem(STORAGE_KEY, next);
		} catch {
			// Preference is session-only then.
		}
	}, []);

	const t = useCallback<Translate>(
		(key, vars) => {
			const template = TABLES[lang][key] ?? en[key] ?? key;
			if (!vars) return template;

			return Object.entries(vars).reduce(
				(text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
				template
			);
		},
		[lang]
	);

	const value = useMemo<I18nValue>(() => ({ lang, setLang, t }), [lang, setLang, t]);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
	const value = useContext(I18nContext);
	if (!value) throw new Error("useI18n must be used inside I18nProvider");
	return value;
}

/** Maps an API error code onto a translated message, with a sane fallback. */
export function translateError(t: Translate, code: string): string {
	const key = `error.${code}` as MessageKey;
	return key in en ? t(key) : t("error.generic");
}
