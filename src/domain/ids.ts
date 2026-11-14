import { RESERVED_NAMES } from "./reserved.ts";

export const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
export const ID_LENGTH = 7;
export const NAME_MAX_BYTES = 96;

const NAME_PATTERN = /^[\p{L}\p{N}_-]{3,32}$/u;
const encoder = new TextEncoder();

export type RandomFill = (bytes: Uint8Array) => Uint8Array;

/** Rejection sampling: bytes at or above the largest multiple of the alphabet size are dropped, so no letter is likelier. */
export function randomString(
  length: number,
  alphabet: string,
  fill: RandomFill = (b) => crypto.getRandomValues(b),
): string {
  const limit = 256 - (256 % alphabet.length);
  let out = "";
  while (out.length < length) {
    for (const byte of fill(new Uint8Array(length * 2))) {
      if (byte >= limit) continue;
      out += alphabet[byte % alphabet.length];
      if (out.length === length) break;
    }
  }
  return out;
}

export function isReserved(name: string): boolean {
  return RESERVED_NAMES.has(name);
}

/** Draws again while the id collides with a reserved name (7 letter routes such as `history` exist). */
export function randomId(
  fill?: RandomFill,
  alphabet: string = ID_ALPHABET,
  length: number = ID_LENGTH,
): string {
  for (;;) {
    const id = randomString(length, alphabet, fill);
    if (!isReserved(id)) return id;
  }
}

export type NameError = "invalid_name" | "name_too_long" | "reserved_name" | "mixed_script";
export type NameResult = { ok: true; name: string } | { ok: false; code: NameError };

const LATIN = /\p{Script=Latin}/u;
const NON_LATIN_LETTER = /[^\p{Script=Latin}\p{N}_-]/u;

/** Latin letters next to letters of any other script are a look-alike risk; a single non-Latin script is fine. */
function mixesScripts(name: string): boolean {
  return LATIN.test(name) && NON_LATIN_LETTER.test(name);
}

export function parseCustomName(input: string): NameResult {
  const name = input.normalize("NFC");
  if (!NAME_PATTERN.test(name)) return { ok: false, code: "invalid_name" };
  if (encoder.encode(name).length > NAME_MAX_BYTES) return { ok: false, code: "name_too_long" };
  if (mixesScripts(name)) return { ok: false, code: "mixed_script" };
  if (isReserved(name.normalize("NFKC").toLowerCase())) return { ok: false, code: "reserved_name" };
  return { ok: true, name };
}
