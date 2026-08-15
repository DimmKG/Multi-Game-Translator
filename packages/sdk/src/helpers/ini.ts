// SPDX-License-Identifier: AGPL-3.0-or-later

/** A line's own trailing terminator; "" only for a final line with no trailing newline. */
export type LineEol = "\n" | "\r\n" | "";

type IniLineContent =
  | { type: "blank"; raw: string }
  | { type: "comment"; raw: string }
  | { type: "section"; raw: string; name: string }
  | { type: "pair"; raw: string; key: string; value: string };

export type IniLine = IniLineContent & { eol: LineEol };

export interface IniRaw {
  /** Dominant eol in the document — a default for lines constructed fresh, not for reconstructing existing ones (each line carries its own). */
  eol: "\n" | "\r\n";
  lines: IniLine[];
}

export interface ParseIniOptions {
  /** Line prefixes treated as comments. Defaults to ["//", "#", ";"]. */
  commentPrefixes?: string[];
}

export interface BuildIniOptions {
  /** Overrides every line's terminator; default preserves each line's own recorded eol. */
  eol?: "\n" | "\r\n";
}

const DEFAULT_COMMENT_PREFIXES = ["//", "#", ";"];

function classifyContent(raw: string, commentPrefixes: string[]): IniLineContent {
  const trimmed = raw.trim();
  if (trimmed === "") return { type: "blank", raw };
  if (commentPrefixes.some((prefix) => trimmed.startsWith(prefix))) {
    return { type: "comment", raw };
  }
  if (/^\[.*\]$/.test(trimmed)) return { type: "section", raw, name: trimmed.slice(1, -1) };
  const equalsIndex = raw.indexOf("=");
  if (equalsIndex < 0) return { type: "comment", raw };
  return {
    type: "pair",
    raw,
    key: raw.slice(0, equalsIndex),
    value: raw.slice(equalsIndex + 1),
  };
}

/**
 * Structural ini parsing shared by the generic-ini File Loader and by
 * ini-flavored Game Loaders (Necesse, Factorio) that need the raw line
 * shape without any status/placeholder semantics mixed in.
 */
export function parseIniLines(text: string, options: ParseIniOptions = {}): IniRaw {
  const commentPrefixes = options.commentPrefixes ?? DEFAULT_COMMENT_PREFIXES;
  const eol: "\n" | "\r\n" = text.includes("\r\n") ? "\r\n" : "\n";
  const parts = text.split(/(\r\n|\n)/);
  const lines: IniLine[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const content = classifyContent(parts[i] ?? "", commentPrefixes);
    const lineEol = (parts[i + 1] as LineEol | undefined) ?? "";
    lines.push({ ...content, eol: lineEol });
  }
  return { eol, lines };
}

/** Inverse of parseIniLines(); reconstructs "key=value" pairs, preserves everything else — including per-line eol — verbatim. */
export function buildIniLines(raw: IniRaw, options: BuildIniOptions = {}): string {
  return raw.lines
    .map((line) => {
      const body = line.type === "pair" ? `${line.key}=${line.value}` : line.raw;
      return body + (options.eol ?? line.eol);
    })
    .join("");
}
