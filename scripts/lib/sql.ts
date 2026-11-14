/** A SQL string literal: single quotes doubled; NUL and other control characters are refused. */
export function sqlString(value: string): string {
  if (/\p{Cc}/u.test(value)) throw new Error("Control characters are not allowed");
  return `'${value.replaceAll("'", "''")}'`;
}
