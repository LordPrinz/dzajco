const STRING = /"(?:[^"\\]|\\.)*"/y;

/** Copies `text`, passing string literals through untouched and the rest through `other`. */
function scan(
  text: string,
  other: (text: string, i: number) => { out: string; next: number },
): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === '"') {
      STRING.lastIndex = i;
      const match = STRING.exec(text);
      if (!match) throw new Error("Unterminated string in JSONC");
      out += match[0];
      i += match[0].length;
    } else {
      const step = other(text, i);
      out += step.out;
      i = step.next;
    }
  }
  return out;
}

/** Parses JSON with comments (`//`, `/* *\/`) and trailing commas, as in wrangler.jsonc. */
export function parseJsonc(text: string): unknown {
  const withoutComments = scan(text, (t, i) => {
    if (t.startsWith("//", i)) {
      const newline = t.indexOf("\n", i);
      return { out: "", next: newline === -1 ? t.length : newline };
    }
    if (t.startsWith("/*", i)) {
      const close = t.indexOf("*/", i + 2);
      if (close === -1) throw new Error("Unterminated comment in JSONC");
      return { out: " ", next: close + 2 };
    }
    return { out: t[i] as string, next: i + 1 };
  });
  const withoutTrailingCommas = scan(withoutComments, (t, i) => {
    const trailing = t[i] === "," && /^\s*[\]}]/.test(t.slice(i + 1));
    return { out: trailing ? "" : (t[i] as string), next: i + 1 };
  });
  return JSON.parse(withoutTrailingCommas);
}
