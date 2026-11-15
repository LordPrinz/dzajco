import { createContext, useContext } from "hono/jsx";
import { DEFAULT_LANG, type Lang } from "../shared/lang";
import type { Theme } from "../shared/theme";
import { PAGE_TEXT, type PageText } from "./text";

/** Per-request settings every view can read without passing them down through props. */
export interface PageSettings {
  theme: Theme;
  lang: Lang;
  /** All page text in `lang`. */
  t: PageText;
  /** Path and query of the current page, where the settings forms send the visitor back to. */
  path: string;
  /** Absolute URL of this page in each language, for `hreflang`; null when the page is not a GET 200. */
  alternates: Record<Lang | "x-default", string> | null;
}

export const PageContext = createContext<PageSettings>({
  theme: "system",
  lang: DEFAULT_LANG,
  t: PAGE_TEXT[DEFAULT_LANG],
  path: "/",
  alternates: null,
});

export function usePage(): PageSettings {
  return useContext(PageContext);
}
