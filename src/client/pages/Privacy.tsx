import { useI18n } from "@/lib/i18n";

const SECTIONS_EN = [
	{
		title: "What we store about a link",
		body: "The destination URL, the short code, the times you set (creation, start, expiry), an optional private label, a hash of the optional password, and a hash of the owner key. We never store the owner key or the password themselves — which is also why neither can be recovered.",
	},
	{
		title: "What we store about a click",
		body: "Counters only. A visit increments a per-day total, a per-country/city total, a referring hostname, and a coarse device/browser bucket. There is no row per visit, no IP address, no user agent string, no cookie set on the visitor, and no way to reconstruct an individual person's path from what is kept.",
	},
	{
		title: "Where the location comes from",
		body: "Cloudflare reports an approximate country and city for the network the request came from, and we round the coordinates to roughly a kilometre before storing them. No geolocation API is called and no IP address is written to the database.",
	},
	{
		title: "Bots",
		body: "Requests that identify as crawlers, chat-app link previewers or automated clients are redirected normally but are not counted, so an unfurled link in a group chat does not inflate your numbers.",
	},
	{
		title: "Accounts",
		body: "If you sign in with GitHub or Google we store the provider's user id, your display name, e-mail address and avatar URL. Signing out clears the session cookie; deleting your links deletes their statistics with them.",
	},
	{
		title: "Anonymous links",
		body: "Links created without an account are tied to an owner key kept in your browser's local storage. Clearing site data loses it, so export your profile from the My links page if you want a backup.",
	},
];

const SECTIONS_PL = [
	{
		title: "Co przechowujemy o linku",
		body: "Adres docelowy, krótki kod, ustawione przez Ciebie daty (utworzenia, startu, wygaśnięcia), opcjonalną prywatną etykietę, skrót opcjonalnego hasła oraz skrót klucza właściciela. Nigdy nie zapisujemy samego klucza ani hasła — dlatego też nie da się ich odzyskać.",
	},
	{
		title: "Co przechowujemy o kliknięciu",
		body: "Wyłącznie liczniki. Wejście zwiększa sumę dzienną, sumę dla kraju i miejscowości, nazwę hosta źródła oraz zgrubną kategorię urządzenia i przeglądarki. Nie ma osobnego wpisu na wejście, adresu IP, pełnego user agenta ani ciasteczka po stronie odwiedzającego — z zapisanych danych nie da się odtworzyć ścieżki konkretnej osoby.",
	},
	{
		title: "Skąd pochodzi lokalizacja",
		body: "Cloudflare podaje przybliżony kraj i miejscowość sieci, z której przyszło żądanie, a współrzędne zaokrąglamy do około kilometra przed zapisem. Nie odpytujemy żadnego API geolokalizacji i nie zapisujemy adresu IP w bazie.",
	},
	{
		title: "Boty",
		body: "Żądania przedstawiające się jako roboty indeksujące, podglądy linków w komunikatorach lub klienty automatyczne są przekierowywane normalnie, ale nie są liczone — podgląd linku na czacie grupowym nie zawyża Twoich statystyk.",
	},
	{
		title: "Konta",
		body: "Po zalogowaniu przez GitHub lub Google zapisujemy identyfikator użytkownika u dostawcy, nazwę wyświetlaną, adres e-mail i adres awatara. Wylogowanie czyści ciasteczko sesji; usunięcie linków usuwa razem z nimi ich statystyki.",
	},
	{
		title: "Linki anonimowe",
		body: "Linki utworzone bez konta są powiązane z kluczem właściciela zapisanym w pamięci lokalnej przeglądarki. Wyczyszczenie danych witryny go usuwa — jeśli chcesz mieć kopię, wyeksportuj profil na stronie Moje linki.",
	},
];

export default function Privacy() {
	const { t, lang } = useI18n();
	const sections = lang === "pl" ? SECTIONS_PL : SECTIONS_EN;

	return (
		<div className="mx-auto mt-14 max-w-2xl">
			<h1 className="text-3xl font-extrabold sm:text-4xl">{t("nav.privacy")}</h1>

			<div className="mt-8 space-y-6">
				{sections.map((section) => (
					<section key={section.title}>
						<h2 className="font-bold text-ink">{section.title}</h2>
						<p className="mt-2 text-sm leading-relaxed text-muted">
							{section.body}
						</p>
					</section>
				))}
			</div>
		</div>
	);
}
