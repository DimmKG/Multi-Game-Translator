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

/** Build a key → value map from a reference `.lang` file. */
export function parseReferenceLang(text: string): Map<string, string> {
  const referenceByKey = new Map<string, string>();
  for (const rawLine of text.split(/\r\n|\n/)) {
    const trimmed = rawLine.trim();
    if (trimmed === "" || trimmed.startsWith("//") || /^\[.*\]$/.test(trimmed)) continue;

    let body = rawLine;
    if (body.startsWith(MISSING_TRANSLATION_PREFIX)) {
      body = body.slice(MISSING_TRANSLATION_PREFIX.length);
    } else if (body.startsWith(SAME_TRANSLATION_PREFIX)) {
      body = body.slice(SAME_TRANSLATION_PREFIX.length);
    }

    const equalsIndex = body.indexOf("=");
    if (equalsIndex < 0) continue;
    referenceByKey.set(body.slice(0, equalsIndex), body.slice(equalsIndex + 1));
  }
  return referenceByKey;
}

/** Apply reference values onto entries; clears previous refs first. */
export function applyReferenceMap(items: LangLine[], referenceByKey: Map<string, string>): number {
  let matchedCount = 0;
  for (const item of items) {
    if (item.type !== "entry") continue;
    delete item.ref;
    const referenceValue = referenceByKey.get(item.key);
    if (referenceValue != null) {
      item.ref = referenceValue;
      matchedCount += 1;
    }
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
