import type { Lang } from "../../shared/lang";
import { en } from "./en";
import { type PageText, pl } from "./pl";

export type { PageText };

export const PAGE_TEXT: Record<Lang, PageText> = { pl, en };
