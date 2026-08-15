// SPDX-License-Identifier: AGPL-3.0-or-later
import { MISSING_TRANSLATION_PREFIX, SAME_TRANSLATION_PREFIX } from "./markers";

/**
 * One line of a raw Necesse `.lang` file, before it's matched against a
 * reference — used where the full toDocument()/reference-matching pipeline
 * isn't needed, e.g. terminology extraction scanning uploaded corpora.
 */
export type NecesseRawLine =
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

export interface NecesseRawFile {
  eol: "\n" | "\r\n";
  items: NecesseRawLine[];
}

function classifyNonEntryLine(line: string): NecesseRawLine {
  const trimmed = line.trim();
  if (trimmed === "") return { type: "blank", raw: line };
  if (trimmed.startsWith("//")) return { type: "comment", raw: line };
  if (/^\[.*\]$/.test(trimmed)) return { type: "section", raw: line, name: trimmed };
  return { type: "comment", raw: line };
}

/** Parses a raw Necesse `.lang` file into ordered lines, without reference matching. */
export function parseNecesseRawFile(text: string): NecesseRawFile {
  const eol: "\n" | "\r\n" = text.includes("\r\n") ? "\r\n" : "\n";
  let currentSection = "";
  const items = text.split(/\r\n|\n/).map((line, lineIndex): NecesseRawLine => {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("//") || /^\[.*\]$/.test(trimmed)) {
      const classified = classifyNonEntryLine(line);
      if (classified.type === "section") currentSection = classified.name;
      return classified;
    }

    let statusPrefix: "none" | "missing" | "same" = "none";
    let body = line;
    if (line.startsWith(MISSING_TRANSLATION_PREFIX)) {
      statusPrefix = "missing";
      body = line.slice(MISSING_TRANSLATION_PREFIX.length);
    } else if (line.startsWith(SAME_TRANSLATION_PREFIX)) {
      statusPrefix = "same";
      body = line.slice(SAME_TRANSLATION_PREFIX.length);
    }

    const equalsIndex = body.indexOf("=");
    if (equalsIndex < 0) return classifyNonEntryLine(line);

    const key = body.slice(0, equalsIndex);
    const english = body.slice(equalsIndex + 1);
    return {
      type: "entry",
      id: lineIndex,
      key,
      english,
      value: english,
      markedSame: statusPrefix === "same",
      wasMissing: statusPrefix === "missing",
      touched: false,
      section: currentSection,
    };
  });

  return { eol, items };
}

/** Strips download-duplication artifacts from a Necesse `.lang` filename without breaking locale codes like pt-BR. */
export function cleanNecesseFilename(name: string): string {
  let base = String(name || "").replace(/\.lang$/i, "");
  base = base.replace(/\s*\(\d+\)\s*$/, "");
  base = base.replace(/_\d+_?/g, "");
  base = base.replace(/^_+|_+$/g, "");
  return base ? `${base}.lang` : "translation.lang";
}
