import * as v from "valibot";

export const KEY_LENGTH = 22;
/** v2 keys came from `nanoid(12)`; links imported from v2 keep them, so they stay valid. */
export const LEGACY_KEY_LENGTH = 12;

const KEY_PATTERN = `(?:[A-Za-z0-9_-]{${KEY_LENGTH}}|[A-Za-z0-9_-]{${LEGACY_KEY_LENGTH}})`;

export const keySchema = v.pipe(v.string(), v.regex(new RegExp(`^${KEY_PATTERN}$`), "Invalid key"));

// RFC 7235: the auth scheme is case-insensitive.
const BEARER = new RegExp(`^bearer ${KEY_PATTERN}$`, "i");

export const bearerSchema = v.pipe(
  v.string(),
  v.regex(BEARER, "Invalid Authorization header"),
  v.transform((header) => header.slice("Bearer ".length)),
);

const urlField = v.pipe(v.string(), v.maxLength(2048));
const nameField = v.pipe(v.string(), v.maxLength(128));

export const createLinkSchema = v.strictObject({
  url: urlField,
  customName: v.optional(nameField),
  expiresAt: v.optional(v.nullable(v.string())),
});

const emptyToUndefined = (value: string): string | undefined => (value === "" ? undefined : value);

/** Browser forms send every field as a string; an empty one means "not set". */
export const formBodySchema = v.strictObject({
  url: urlField,
  customName: v.optional(v.pipe(nameField, v.transform(emptyToUndefined))),
  expiresAt: v.optional(
    v.pipe(
      v.string(),
      v.transform((value) => (value === "" ? null : value)),
    ),
  ),
});

export type CreateLinkInput = v.InferOutput<typeof createLinkSchema>;
export type FormBodyInput = v.InferOutput<typeof formBodySchema>;
