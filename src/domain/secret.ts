// Link secret keys: generation and peppered HMAC-SHA256 hashing (ADR 0003).
// WebCrypto only, so it runs unchanged in workerd and in bun test.

export type Peppers = Readonly<Record<number, string | undefined>>;

const encoder = new TextEncoder();
const VERSION = /^[1-9][0-9]{0,8}$/;
const STORED_FORMAT = /^v([1-9][0-9]{0,8}):([0-9a-f]{64})$/;
const PEPPER_ENV_KEY = /^SECRET_PEPPER_V([1-9][0-9]{0,8})$/;

export function generateSecretKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function importPepper(pepper: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

async function hmacHex(key: string, pepper: string): Promise<string> {
  const hmacKey = await importPepper(pepper, "sign");
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, encoder.encode(key)));
  return Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashSecret(
  key: string,
  options: { version: number; peppers: Peppers },
): Promise<string> {
  const pepper = options.peppers[options.version];
  if (!pepper) {
    throw new Error(`Missing secret pepper for version ${options.version}`);
  }
  return `v${options.version}:${await hmacHex(key, pepper)}`;
}

const warnedMissing = new Set<number>();

export async function verifySecret(
  key: string,
  stored: string,
  peppers: Peppers,
): Promise<boolean> {
  try {
    if (typeof key !== "string" || typeof stored !== "string") return false;
    const match = STORED_FORMAT.exec(stored);
    if (!match) return false;
    const version = Number(match[1]);
    const pepper = peppers[version];
    if (!pepper) {
      if (!warnedMissing.has(version)) {
        warnedMissing.add(version);
        console.warn(`secret pepper v${version} missing`);
      }
      return false;
    }
    const digest = Uint8Array.from((match[2] as string).match(/../g) ?? [], (byte) =>
      Number.parseInt(byte, 16),
    );
    const hmacKey = await importPepper(pepper, "verify");
    return await crypto.subtle.verify("HMAC", hmacKey, digest, encoder.encode(key));
  } catch {
    return false;
  }
}

export function peppersFromEnv(env: object): Peppers {
  const peppers: Record<number, string> = {};
  for (const [name, value] of Object.entries(env)) {
    const match = PEPPER_ENV_KEY.exec(name);
    if (match && typeof value === "string" && value !== "") {
      peppers[Number(match[1])] = value;
    }
  }
  return peppers;
}

export function currentVersion(env: object): number {
  const raw = (env as { SECRET_PEPPER_VERSION?: unknown }).SECRET_PEPPER_VERSION;
  if (typeof raw !== "string" || !VERSION.test(raw)) {
    throw new Error("SECRET_PEPPER_VERSION must be a positive integer");
  }
  return Number(raw);
}
