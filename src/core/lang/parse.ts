// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  MISSING_TRANSLATION_PREFIX,
  SAME_TRANSLATION_PREFIX,
  type LangLine,
  type ParsedLangFile,
} from "./markers";

function classifyNonEntryLine(line: string): LangLine {
  const trimmed = line.trim();
  if (trimmed === "") return { type: "blank", raw: line };
  if (trimmed.startsWith("//")) return { type: "comment", raw: line };
  if (/^\[.*\]$/.test(trimmed)) return { type: "section", raw: line, name: trimmed };
  return { type: "comment", raw: line };
}

/** Parse a Necesse `.lang` document into ordered workspace lines. */
export function parseLangFile(text: string): ParsedLangFile {
  const eol: "\n" | "\r\n" = text.includes("\r\n") ? "\r\n" : "\n";
  let currentSection = "";
  const items = text.split(/\r\n|\n/).map((line, lineIndex): LangLine => {
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

/**
 * Reference lookup built from a `.lang` file.
 * Indexed by section + key (comments / blanks ignored) so duplicate keys in
 * different sections stay distinct. Multiple values under the same identity
 * are kept in file order and consumed by occurrence.
 */
export interface ReferenceIndex {
  bySectionKey: Map<string, string[]>;
}

/** Stable identity for a reference/entry pair within one section. */
export function referenceIdentity(section: string, key: string): string {
  return `${section}\u0000${key}`;
}

/** Build a section+key index from a reference `.lang` file (comments skipped). */
export function parseReferenceLang(text: string): ReferenceIndex {
  const bySectionKey = new Map<string, string[]>();
  let currentSection = "";
  for (const rawLine of text.split(/\r\n|\n/)) {
    const trimmed = rawLine.trim();
    if (trimmed === "" || trimmed.startsWith("//")) continue;
    if (/^\[.*\]$/.test(trimmed)) {
      currentSection = trimmed;
      continue;
    }

    let body = rawLine;
    if (body.startsWith(MISSING_TRANSLATION_PREFIX)) {
      body = body.slice(MISSING_TRANSLATION_PREFIX.length);
    } else if (body.startsWith(SAME_TRANSLATION_PREFIX)) {
      body = body.slice(SAME_TRANSLATION_PREFIX.length);
    }

    const equalsIndex = body.indexOf("=");
    if (equalsIndex < 0) continue;
    const identity = referenceIdentity(currentSection, body.slice(0, equalsIndex));
    const value = body.slice(equalsIndex + 1);
    const queue = bySectionKey.get(identity);
    if (queue) queue.push(value);
    else bySectionKey.set(identity, [value]);
  }
  return { bySectionKey };
}

/** First reference value for `key` in any section (metadata helpers). */
export function firstReferenceByKey(index: ReferenceIndex, key: string): string | undefined {
  for (const [identity, values] of index.bySectionKey) {
    const separator = identity.lastIndexOf("\u0000");
    if (separator < 0) continue;
    if (identity.slice(separator + 1) === key) return values[0];
  }
  return undefined;
}

/** Apply reference values onto entries by section+key occurrence; clears previous refs. */
export function applyReferenceMap(items: LangLine[], reference: ReferenceIndex): number {
  const cursors = new Map<string, number>();
  let matchedCount = 0;
  for (const item of items) {
    if (item.type !== "entry") continue;
    delete item.ref;
    const identity = referenceIdentity(item.section ?? "", item.key);
    const values = reference.bySectionKey.get(identity);
    if (!values?.length) continue;
    const cursor = cursors.get(identity) ?? 0;
    if (cursor >= values.length) continue;
    item.ref = values[cursor];
    cursors.set(identity, cursor + 1);
    matchedCount += 1;
  }
  return matchedCount;
}

/**
 * Create a new translation workspace text from a reference file:
 * every entry becomes MISSING_TRANSLATION while structure is preserved.
 */
export function createTranslationFromReference(
  text: string,
  referenceFilename = "",
): { text: string; referenceFilename: string; entryCount: number } {
  const source = String(text ?? "");
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  let entryCount = 0;
  const output = source
    .split(/\r\n|\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || /^\[.*\]$/.test(trimmed)) return line;
      let body = line;
      if (body.startsWith(MISSING_TRANSLATION_PREFIX)) {
        body = body.slice(MISSING_TRANSLATION_PREFIX.length);
      } else if (body.startsWith(SAME_TRANSLATION_PREFIX)) {
        body = body.slice(SAME_TRANSLATION_PREFIX.length);
      }
      if (body.indexOf("=") < 0) return line;
      entryCount += 1;
      return MISSING_TRANSLATION_PREFIX + body;
    })
    .join(eol);

  return {
    text: output,
    referenceFilename: String(referenceFilename || ""),
    entryCount,
  };
}

/** Strip download-duplication artifacts without breaking locale codes like pt-BR. */
export function cleanLangFilename(name: string): string {
  let base = String(name || "").replace(/\.lang$/i, "");
  base = base.replace(/\s*\(\d+\)\s*$/, "");
  base = base.replace(/_\d+_?/g, "");
  base = base.replace(/^_+|_+$/g, "");
  return base ? `${base}.lang` : "translation.lang";
}

export { classifyNonEntryLine };
