import type { Lang } from "../lang";
import { en } from "./en";
import { pl, type SharedText } from "./pl";

export type { SharedText };

export const SHARED_TEXT: Record<Lang, SharedText> = { pl, en };
