// Runs in GitHub Actions (see .github/workflows/wiki.yml): turns the repository docs into wiki pages.
// Usage: bun scripts/gh/wiki.ts <wiki checkout>
import { rm } from "node:fs/promises";
import path from "node:path";
import { Glob } from "bun";
import { TRUNK } from "../git/conventions.ts";

export interface Doc {
  /** Repository-relative path, e.g. `docs/adr/0001-monorepo-on-bun.md`. */
  path: string;
  content: string;
}

export interface Page {
  /** Wiki file name without `.md`; GitHub shows it with dashes as spaces. */
  name: string;
  content: string;
}

const ADR_DIR = "docs/adr";
const ADR_HEADING = "Architecture decision records";
const ADR_ANCHOR = "Home#architecture-decision-records";

const isAdr = (doc: Doc) =>
  path.posix.dirname(doc.path) === ADR_DIR && /^\d+-/.test(path.posix.basename(doc.path));
const title = (doc: Doc) =>
  /^# (.+)$/m.exec(doc.content)?.[1]?.trim() ?? path.basename(doc.path, ".md");
/** ADR headings are numbered (`# 1. Monorepo on Bun`); the wiki shows the number separately. */
const adrTitle = (doc: Doc) => title(doc).replace(/^\d+\.\s*/, "");
const adrNumber = (doc: Doc) => /^(\d+)-/.exec(path.basename(doc.path))?.[1] ?? "";

export function pageName(doc: Doc): string {
  if (doc.path === "README.md") return "Home";
  const name = isAdr(doc) ? `ADR ${adrNumber(doc)} ${adrTitle(doc)}` : title(doc);
  return name
    .replace(/[\\/:*?"<>|#%]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Points relative links at wiki pages, or at the file on the trunk branch when it is not a doc. */
export function rewriteLinks(
  content: string,
  from: string,
  pages: Map<string, string>,
  repoUrl: string,
): string {
  let inFence = false;
  return content
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
      if (inFence) return line;
      return line.replace(
        /(!?\[[^\]]*\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g,
        (_, open: string, target: string, close: string) =>
          open + resolveLink(target, from, pages, repoUrl, open.startsWith("!")) + close,
      );
    })
    .join("\n");
}

function resolveLink(
  target: string,
  from: string,
  pages: Map<string, string>,
  repoUrl: string,
  image: boolean,
): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) return target;
  const [file = "", anchor] = target.split("#", 2);
  const suffix = anchor ? `#${anchor}` : "";
  const resolved = file.startsWith("/")
    ? path.posix.normalize(file.slice(1))
    : path.posix.join(path.posix.dirname(from), file);
  const normalized = resolved.replace(/\/$/, "");
  const page = pages.get(normalized);
  if (page) return page + suffix;
  if (normalized === ADR_DIR) return ADR_ANCHOR;
  // A blob URL is an HTML page, so images need the raw file.
  return `${repoUrl}/${image ? "raw" : "blob"}/${TRUNK}/${normalized}${suffix}`;
}

function adrIndex(adrs: Doc[], pages: Map<string, string>): string {
  const rows = adrs.map((doc) => {
    const status = /\*\*Status:\*\*\s*(.+)/.exec(doc.content)?.[1]?.trim() ?? "";
    return `| [${adrNumber(doc)}](${pages.get(doc.path)}) | ${adrTitle(doc)} | ${status} |`;
  });
  return [
    `## ${ADR_HEADING}`,
    "",
    "| #   | Decision | Status |",
    "| --- | --- | --- |",
    ...rows,
  ].join("\n");
}

/** README becomes Home (with the ADR index appended); every other doc becomes its own page. */
export function buildWiki(docs: Doc[], repoUrl: string): Page[] {
  const pages = new Map(docs.map((doc) => [doc.path, pageName(doc)]));
  const adrs = docs.filter(isAdr).sort((a, b) => a.path.localeCompare(b.path));
  const others = docs.filter((doc) => !isAdr(doc) && doc.path !== "README.md");

  const result: Page[] = docs.map((doc) => {
    const content = rewriteLinks(doc.content, doc.path, pages, repoUrl).trimEnd();
    return {
      name: pageName(doc),
      content:
        doc.path === "README.md" ? `${content}\n\n${adrIndex(adrs, pages)}\n` : `${content}\n`,
    };
  });

  const sidebar = [
    "- [Home](Home)",
    ...others.map((doc) => `- [${title(doc)}](${pages.get(doc.path)})`),
    "",
    `**${ADR_HEADING}**`,
    "",
    ...adrs.map((doc) => `- [${adrNumber(doc)} ${adrTitle(doc)}](${pages.get(doc.path)})`),
  ];
  result.push({ name: "_Sidebar", content: `${sidebar.join("\n")}\n` });
  result.push({
    name: "_Footer",
    content: `Generated from the [repository docs](${repoUrl}/tree/${TRUNK}/docs). Edit the files there; changes made in the wiki are overwritten.\n`,
  });

  const names = new Set<string>();
  for (const { name } of result) {
    if (names.has(name)) throw new Error(`Two pages would be written as "${name}.md"`);
    names.add(name);
  }
  return result;
}

if (import.meta.main) {
  const outDir = process.argv[2];
  if (!outDir) {
    console.error("Usage: bun scripts/gh/wiki.ts <wiki checkout>");
    process.exit(1);
  }
  const repoUrl = `${Bun.env.GITHUB_SERVER_URL ?? "https://github.com"}/${Bun.env.GITHUB_REPOSITORY ?? "LordPrinz/dzajco"}`;

  const sources = ["README.md"];
  for await (const file of new Glob("docs/**/*.md").scan()) sources.push(file);
  const docs = await Promise.all(
    sources.sort().map(async (file) => ({ path: file, content: await Bun.file(file).text() })),
  );

  // The wiki only holds generated pages, so stale ones (renamed or deleted docs) are removed.
  for await (const file of new Glob("*.md").scan(outDir)) await rm(path.join(outDir, file));
  const pages = buildWiki(docs, repoUrl);
  for (const page of pages) await Bun.write(path.join(outDir, `${page.name}.md`), page.content);
  console.info(`Wrote ${pages.length} wiki pages to ${outDir}.`);
}
