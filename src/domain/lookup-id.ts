// No imports, so the browser scripts can use it too.

/**
 * Lookup ids on redirect (after NFC) are looser than new custom names: names imported from v2 may
 * contain spaces and other characters the creation policy now rejects. Only `/`, control and
 * format characters (zero-width, bidi overrides) are ruled out.
 */
export const LOOKUP_ID = /^[^/\p{Cc}\p{Cf}]{1,64}$/u;
