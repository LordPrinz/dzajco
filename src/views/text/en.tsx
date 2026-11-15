import { en as common } from "../../shared/text/en";
import type { ApiText } from "./api";
import type { PageText } from "./pl";

const api: ApiText = {
  title: "API",
  heading: "dzajco API v1",
  lead: (origin) => (
    <>
      A public JSON API to create, read and delete links. Base URL: <code>{origin}</code>.
    </>
  ),
  toc: "Contents",
  sections: {
    endpoints: "Endpoints",
    errors: "Errors",
    limits: "Limits",
    cors: "CORS, key and headers",
    corsShort: "CORS and key",
    examples: "Examples",
    migration: "Moving from v2",
  },
  input: "Input.",
  status: "Status",
  body: "Body",
  code: "Code",
  meaning: "Meaning",
  route: "Route",
  limit: "Limit",
  errorShape: "Every error has the same shape:",
  endpoints: {
    create: {
      summary: "Creates a link. Needs the header Content-Type: application/json.",
      input: "JSON: url (required), customName (optional), expiresAt (ISO 8601 or null).",
      responses: {
        201: "{ id, shortUrl, url, secretKey, expiresAt }. url is the normalised target (host in punycode).",
        400: "invalid_json, invalid_body or a domain code from the table below.",
        409: "id_taken",
        413: "payload_too_large (body over 8 KB)",
        415: "unsupported_media_type",
        429: "rate_limited",
        503: "service_unavailable",
      },
    },
    get: {
      summary: "Returns the link's target without redirecting.",
      input: "None.",
      responses: {
        200: "{ id, url, expiresAt }",
        404: "not_found",
        410: "expired or link_disabled",
        429: "rate_limited",
      },
    },
    stats: {
      summary:
        "Stats of a link. Without an Authorization header you get the public view, with the right key the owner's view.",
      input: "Optional Authorization: Bearer <key>.",
      responses: {
        200: "{ visits, countries: [{ code, visits }], partial }. With the key, cities too.",
        403: "forbidden. Returned for any Authorization header that is not this link's key. There is no fallback to the public view.",
        404: "not_found",
        410: "expired or link_disabled",
        429: "rate_limited",
      },
    },
    delete: {
      summary: "Deletes a link together with its stats.",
      input: "Authorization: Bearer <key>. The body is ignored.",
      responses: {
        204: "No content.",
        400: "invalid_key (no key or a malformed one)",
        403: "forbidden (the key does not match the link)",
        404: "not_found",
        429: "rate_limited",
      },
    },
    globalStats: {
      summary: "Stats of the whole service. The numbers cover live links only.",
      input: "None.",
      responses: {
        200: "{ links, visits, countries: [{ code, visits }], updatedAt }. The numbers are recomputed once a day and can lag by about 24 hours.",
        429: "rate_limited",
      },
    },
  },
  errorCodes: {
    invalid_json: "The request body is not valid JSON.",
    invalid_body:
      "The body does not match the schema: url missing, a field of the wrong type or an unknown field.",
    invalid_url: "url is not a valid URL.",
    unsupported_scheme: "Only http: and https: are allowed.",
    url_too_long: "url is longer than 2048 characters.",
    credentials_not_allowed: "The address contains credentials (user:password@).",
    own_host: "The address points to this service.",
    private_target: "A local, private or reserved address (IPv4, IPv6, localhost).",
    blocked_target: "The address is another link shortener or is on the block list.",
    invalid_name:
      "customName has 3 to 32 letters, digits, _ or -. It is stored in NFKC form, so full-width letters become plain ones.",
    name_too_long: "customName is too long.",
    reserved_name: "customName is reserved by the service.",
    mixed_script: "customName mixes the Latin alphabet with another script or its digits.",
    invalid_expiry: "expiresAt is not an existing date in ISO 8601 format.",
    expiry_in_past: "expiresAt is in the past.",
    expiry_too_far: "expiresAt is more than a year from now.",
    invalid_key: "DELETE without a key or with a malformed key.",
    forbidden: "The key does not match the link.",
    not_found: "No such link.",
    id_taken: "customName is already taken.",
    expired: "The link has expired.",
    link_disabled: "The link was disabled for abuse.",
    payload_too_large: "The request body is over 8 KB.",
    unsupported_media_type: "Content-Type must be application/json.",
    rate_limited: "Rate limit exceeded. See Retry-After.",
    internal_error: "Server error.",
    service_unavailable: "Checking the block list failed. Try again later.",
  },
  limitsIntro: (
    <>
      Limits count per IP address in a 60-second window. Over the limit you get 429 with a{" "}
      <code>Retry-After</code> header. Each location counts on its own, so the limits guard against
      abuse rather than count exactly.
    </>
  ),
  limits: [
    "10 per minute",
    "10 per minute",
    "120 per minute, shared with GET /:id redirects",
    "60 per minute",
  ],
  cors: [
    <>
      <code>GET</code> responses carry <code>Access-Control-Allow-Origin: *</code>. The server never
      echoes the <code>Origin</code> header and does not allow credentials.
    </>,
    <>
      <code>POST</code> and <code>DELETE</code> have no CORS. Call them from a server or from the
      same domain.
    </>,
    <>
      You get the key (<code>secretKey</code>) once, in the 201 response. It has 22 characters
      (base64url). Keys of links moved over from v2 have 12 characters (A-Z, a-z, 0-9, _, -) and
      work the same way. Send it as <code>Authorization: Bearer &lt;key&gt;</code> (the scheme name
      is case-insensitive). Never in the URL or the query string.
    </>,
    <>
      Every link has its own key. The 201 response, the owner's stats response and the result page
      carry <code>Cache-Control: no-store</code>.
    </>,
    <>
      JSON responses carry <code>Content-Security-Policy: default-src 'none'</code>.
    </>,
  ],
  examples: {
    create: "Create a link",
    response: "201 response:",
    stats: "Public and owner stats",
    delete: "Delete a link",
    key: "key",
    longPath: "long/path",
    name: "my-link",
    keySample: "22 characters",
    partial: (
      <>
        The <code>partial</code> field in the stats is <code>true</code> when the latest visits
        could not be read. Data from earlier days is complete then.
      </>
    ),
  },
  migration: {
    intro: (
      <>
        The old <code>/api/urls</code> paths have no alias. <code>/dzajapi</code> redirects (301)
        here. Update your calls as in the table.
      </>
    ),
    v2: "v2 endpoint",
    v1: "v1 endpoint",
    changes: "What changed",
    rows: [
      "The response is { id, url, expiresAt } instead of { fullLink }.",
      "The response is { visits, countries, partial }. Cities only with the key. The /:id/info page redirects (301) to /:id/stats.",
      "The expire field is now expiresAt (ISO 8601 or null). The 201 response is { id, shortUrl, url, secretKey, expiresAt }, without message. Validation errors are 400 instead of 422, a taken name is 409. Content-Type: application/json is required.",
      "The key goes in the Authorization: Bearer <key> header, not in a { secretKey } body and never in the URL. Success is 204 with no content.",
    ],
    errors: (
      <>
        Errors look like <code>{"{ error: { code, message } }"}</code> instead of{" "}
        <code>{'{ error: "..." }'}</code>. Tell them apart by <code>code</code>.
      </>
    ),
  },
};

export const en: PageText = {
  common,
  meta: {
    description:
      "A free link shortener by Dzajlopment. Custom names, expiry dates and a visit counter.",
    locale: "en_GB",
  },
  nav: {
    home: "Home",
    about: "About",
    history: "History",
    api: "API",
    privacy: "Privacy",
    footer: "Footer navigation",
  },
  settings: {
    theme: "Theme",
    system: "System theme",
    light: "Light theme",
    dark: "Dark theme",
    language: "Language",
  },
  hero: { subtitle: "The best link shortener on the internet." },
  home: {
    urlLabel: "Link to shorten",
    urlPlaceholder: "Link",
    submit: "Shorten",
    moreOptions: "More options",
    customName: "Custom name",
    expiry: "Expires",
    customDateLabel: "Custom expiry date (UTC)",
    customDateHint: "UTC time. Used only when “Custom date” is selected.",
    lookupTitle: "Link stats",
    lookupLabel: "Short link or its code",
    lookupPlaceholder: "Link or code",
    lookupSubmit: "Show stats",
  },
  result: {
    title: "Your link is ready",
    shortLink: "Short link",
    target: "Goes to:",
    idn: (host) => (
      <>
        The target address uses international characters. The real domain (punycode) is {host}. Make
        sure it is the site you mean.
      </>
    ),
    expires: "Expires:",
    keyTitle: "Save the key",
    keyText:
      "This key lets you delete the link and see its full stats. Save it now, it will not be shown again.",
    stats: "Stats",
    another: "Shorten another link",
    share: "Share",
  },
  created: { title: "Link created" },
  notices: {
    back: "Back to the form",
    error: { title: "Something went wrong", message: "Try again in a moment." },
    forbidden: {
      title: "Request refused",
      message: "The form can only be sent from this site.",
    },
    rateLimited: {
      title: "Too many requests",
      message: "Too many links were created in a short time. Try again in a minute.",
    },
    unsupported: { title: "Unsupported format", message: "Send the form from this site." },
    tooLarge: {
      title: "The form is too large",
      message: "Shorten what you entered and try again.",
    },
    notFound: { title: "Page not found", message: "This page does not exist." },
  },
  linkError: {
    not_found: {
      title: "Link not found",
      message: "This short link does not exist or has been deleted.",
    },
    expired: {
      title: "This link has expired",
      message: "This link had an expiry date, and that date has passed.",
    },
    disabled: {
      title: "This link has been disabled",
      message: "The link pointed to an address that was blocked for abuse.",
    },
    report: "Report abuse",
    shortenOwn: "Shorten your own link",
  },
  history: {
    title: "History",
    heading: "Link history",
    lead: "Links created in this browser. The list is stored only here, on your device.",
    loading: "Loading the history…",
    noscript: "The history needs JavaScript.",
    empty: "No saved links.",
    emptyLink: "Shorten your first link",
    note: "Only links saved together with their key can be deleted. Entries without a key are read-only.",
  },
  stats: {
    title: (id) => `Stats ${id}`,
    heading: "Link stats",
    visits: "Visits",
    countries: "Countries",
    noVisits: "No visits",
    partial: "The latest visits may not show yet.",
    cities: "Cities",
    noCities: "No city data",
    showMap: "Show map",
    map: "Map of visits",
    ownerHint:
      "Cities and the map show only in the browser that created the link (it needs the key from the history).",
  },
  about: {
    title: "About",
    heading: (brand) => <>Why {brand}</>,
    lead: "A simple, fast link shortener. It does one thing: turns a long address into a short one that works for as long as you want.",
    features: {
      login: {
        title: "No sign-up",
        text: "No accounts. Shorten a link right away, without making a profile.",
      },
      expiry: {
        title: "Expiry date",
        text: "Choose when the link stops working. Handy for promotions and short-lived shares.",
      },
      name: {
        title: "Custom names",
        text: "Give the link your own name or let the service pick a short, unique id.",
      },
      delete: {
        title: "Delete any time",
        text: "With the key you get when the link is made, you can delete it whenever you like.",
      },
      visitors: {
        title: "Visit counter",
        text: "See how many times the link was opened and from which countries. The key holder also sees the cities.",
      },
      history: {
        title: "History",
        text: "Links made in this browser stay on a list, so they are easy to copy or delete.",
      },
    },
    numbers: "The service in numbers",
    notYet: "The stats appear after the first daily recount.",
    links: "Live links",
    visits: "Visits to live links",
    topCountries: "Countries with the most visits",
    updated: "Updated:",
    liveOnly: "Deleted and expired links are not counted, and their visits go with them.",
    daily: "The numbers are recounted once a day, so they can lag by about 24 hours.",
    support: "Support the project",
    supportText: "Dzajco is free. If you find it useful, you can support its development.",
    sponsor: "Sponsor LordPrinz on GitHub Sponsors",
  },
  privacy: {
    title: "Privacy policy",
    updated: "15 November 2026",
    lead: (date) => (
      <>
        Last updated: {date}. We collect as much data as a link needs to work and to show where its
        visitors come from.
      </>
    ),
    stored: {
      heading: "What we store",
      items: [
        <>
          <strong>Links.</strong> The short name, the target address, the creation date and the
          expiry date. An expired link is deleted.
        </>,
        <>
          <strong>Archive of deleted links.</strong> A link its owner deletes goes into an internal
          archive for 30 days: the target address, the dates and the visit totals, not the key. Only
          the service operator can see it, and the entry is removed after 30 days.
        </>,
        <>
          <strong>Deletion keys, hashed.</strong> We show the key once, when the link is created. We
          store only its cryptographic hash (HMAC), so we cannot recover it or remind you of it.
        </>,
        <>
          <strong>Aggregated visit counts.</strong> For each link, the number of visits by country
          and city. Country and city come from the data Cloudflare attaches to the request. The
          counts do not point to any single person and stay in the database while the link exists.
        </>,
        <>
          <strong>Visit events.</strong> Each visit to a link is written to Cloudflare Analytics
          Engine as an event: time, link id, country, city and approximate coordinates. We do not
          store the IP address or the User-Agent header. Events are kept for up to 3 months, after
          which only the aggregated counts in the database remain.
        </>,
      ],
    },
    ip: {
      heading: "IP addresses",
      text: "Client IP addresses appear only in the logs of Cloudflare itself, which is our infrastructure provider. Our application does not write them to the database or to its own logs. It uses the IP address only for short-term rate limiting and does not keep it.",
    },
    analytics: {
      heading: "Site analytics",
      text: "We use Cloudflare Web Analytics without cookies. It counts page views of the site in aggregate, with no cross-site tracking and no profiling.",
    },
    local: {
      heading: "History in your browser",
      text: (
        <>
          The list of your links, with their deletion keys, is saved in your browser's local storage
          (localStorage, key <code>links-history</code>). It lives only on your device and never
          reaches our server. Clearing the browser's data removes it for good. Deleting a link needs
          its key, so save the key separately if you want access from another device.
        </>
      ),
    },
    cookies: {
      heading: "Cookies",
      text: (
        <>
          The service sets two cookies, and only when you use the switches in the header:{" "}
          <code>theme</code> remembers a light or dark theme and <code>lang</code> the language you
          picked. Each lasts a year and is not used for tracking. Going back to the system theme
          removes <code>theme</code>.
        </>
      ),
    },
    map: {
      heading: "The map on the stats page",
      text: "The city map in the link owner's stats loads tiles from OpenStreetMap (tile.openstreetmap.org). Your browser then sends OpenStreetMap its IP address and the part of the map it shows, but not the link. The map loads only once you open it.",
    },
    contact: {
      heading: "Contact",
      withLink: (link) => <>Questions about data and abuse reports: {link}.</>,
      linkText: "write to us",
      withoutLink: "Send questions about data and abuse reports to the site administrator.",
    },
  },
  api,
};
