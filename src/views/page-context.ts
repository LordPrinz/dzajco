import { createContext, useContext } from "hono/jsx";
import type { Theme } from "../shared/theme";

/** Per-request settings every view can read without passing them down through props. */
export interface PageSettings {
  theme: Theme;
  /** Path and query of the current page, where the settings forms send the visitor back to. */
  path: string;
}

export const PageContext = createContext<PageSettings>({ theme: "system", path: "/" });

export function usePage(): PageSettings {
  return useContext(PageContext);
}
