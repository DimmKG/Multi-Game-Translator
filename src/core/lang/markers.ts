export const MISSING_TRANSLATION_PREFIX = "MISSING_TRANSLATION:";
export const SAME_TRANSLATION_PREFIX = "SAME_TRANSLATION:";

export const PROTECTED_TOKEN_PATTERN = /<[^>]+>|\[[^\]]+\]|§(?:#[0-9a-fA-F]{6}|[0-9A-Za-z])|\\n/g;

export type EntryStatus = "missing" | "done" | "same";
export type FilterMode = "missing" | "done" | "same" | "all" | "ws";
export type WorkspaceView = "editor" | "review" | "diff";
export type ReviewFilter = "all" | "mt" | "issues" | "same";
export type DiffMode = "word" | "character";

export type LangLine =
  | { type: "blank"; raw: string }
  | { type: "comment"; raw: string }
  | { type: "section"; raw: string; name: string }
  | {
      type: "entry";
      id: number;
      key: string;
      english: string;
      value: string;
      markedSame: boolean;
      wasMissing: boolean;
      touched: boolean;
      mtDraft?: boolean;
      ref?: string;
      section?: string;
    };

export interface ParsedLangFile {
  eol: "\n" | "\r\n";
  items: LangLine[];
}
