// Text used both on the server and in the browser scripts. Keep it free of runtime imports.

export const pl = {
  /** Messages for the error codes of the create form and the API. */
  errors: {
    invalid_url: "To nie wygląda na poprawny adres URL.",
    url_too_long: "Adres jest za długi (maksymalnie 2048 znaków).",
    unsupported_scheme: "Dozwolone są tylko adresy http i https.",
    credentials_not_allowed: "Adres nie może zawierać nazwy użytkownika ani hasła.",
    own_host: "Nie skracamy linków do tego serwisu.",
    private_target: "Adresy prywatne i lokalne są niedozwolone.",
    blocked_target: "Ten adres jest niedozwolony.",
    invalid_body: "Formularz zawiera nieprawidłowe dane.",
    invalid_name: "Własna nazwa ma mieć od 3 do 32 liter, cyfr, znaków _ lub -.",
    name_too_long: "Własna nazwa jest za długa.",
    reserved_name: "Ta nazwa jest zarezerwowana.",
    mixed_script: "Nazwa miesza litery łacińskie z innym alfabetem.",
    id_taken: "Ta nazwa jest już zajęta.",
    invalid_expiry: "Podaj istniejącą datę wygaśnięcia.",
    expiry_in_past: "Data wygaśnięcia musi być w przyszłości.",
    expiry_too_far: "Link może wygasać najpóźniej za rok.",
    rate_limited: "Za dużo żądań. Spróbuj ponownie za minutę.",
    service_unavailable: "Usługa jest chwilowo niedostępna. Spróbuj ponownie za chwilę.",
  },
  fallbackError: "Coś poszło nie tak. Spróbuj ponownie.",
  expiry: {
    never: "Nigdy",
    "1h": "1 godzina",
    "1d": "1 dzień",
    "1w": "1 tydzień",
    "1m": "30 dni",
    custom: "Własna data",
  },
  unknownCountry: "Nieznany kraj",
  copy: {
    button: "Kopiuj",
    done: "Skopiowano",
    failed: "Nie udało się",
    toast: "Skopiowano do schowka",
    failedToast: "Nie udało się skopiować. Zaznacz tekst i skopiuj go ręcznie.",
  },
  toastClose: "Zamknij",
  form: {
    sending: "Skracanie…",
    localDateLabel: "Własna data wygaśnięcia (czas lokalny)",
    localDateHint: "Czas lokalny. Używana tylko przy wyborze „Własna data”.",
  },
  history: {
    target: "Cel",
    created: "Utworzono",
    expires: "Wygasa",
    never: "nigdy",
    stats: "Statystyki",
    delete: "Usuń",
    deleteLabel: (id: string) => `Usuń link ${id}`,
    readOnly: "Tylko do odczytu (brak klucza)",
    deleted: (id: string) => `Usunięto link ${id}`,
    rateLimited: "Za dużo żądań. Spróbuj ponownie za minutę.",
    keyRejected: "Ten klucz nie pasuje do linku.",
    deleteFailed: "Nie udało się usunąć linku. Spróbuj ponownie.",
  },
};

export type SharedText = typeof pl;
