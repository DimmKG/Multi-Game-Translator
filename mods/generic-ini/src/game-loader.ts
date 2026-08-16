// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  defaultIdentityStrategy,
  iniFileLoader,
  type DocumentNode,
  type EntryPatch,
  type EntryUiHints,
  type FileLoaderInput,
  type GameLoader,
  type IniFileLoaderRaw,
  type IniLine,
  type LineEol,
  type RequiredFile,
  type TranslationDocument,
  type TranslationEntry,
} from "@mgt/sdk";

type GenericIniFormatMeta = {
  eol: "\n" | "\r\n";
  /** Whether the source translation file's last line had a trailing newline. */
  trailingNewline: boolean;
};

/** Only tracked native fact: did this entry's source actually come from a matched reference, or its own value as fallback. No markedSame/wasMissing/originalValue — this format has none of those concepts. */
type GenericIniEntryExt = { hasReference: boolean };

/** Same null-byte join convention as defaultIdentityStrategy — never collides with a real section/key name. */
const REFERENCE_SEPARATOR = String.fromCharCode(0);

/** No native marker to round-trip — status is derived purely from whether target is empty. */
function statusFromTarget(target: string): "missing" | "translated" {
  return target.trim() === "" ? "missing" : "translated";
}

function findRoleIndex(roles: { role: string }[], role: string): number {
  return roles.findIndex((entry) => entry.role === role);
}

/**
 * Validates doc.formatMeta actually has the shape toDocument() produces
 * before trusting it — an unchecked cast here degrades to silently wrong
 * output instead of a clear error.
 */
function readFormatMeta(doc: TranslationDocument): GenericIniFormatMeta {
  const meta = doc.formatMeta;
  const eol = meta.eol;
  const trailingNewline = meta.trailingNewline;
  if ((eol !== "\n" && eol !== "\r\n") || typeof trailingNewline !== "boolean") {
    throw new TypeError(
      "TranslationDocument.formatMeta is missing valid generic-ini fields (eol/trailingNewline) — was this document produced by genericIniGameLoader.toDocument()?",
    );
  }
  return { eol, trailingNewline };
}

/**
 * Last occurrence wins on a duplicate (section, key) pair — a deliberate
 * simplification relative to Necesse's per-occurrence reference queue. This
 * loader exists to prove the interface generalizes, not to match every
 * quirk of a richer format.
 */
function buildReferenceMap(
  referenceRaw: IniFileLoaderRaw[number] | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!referenceRaw) return map;
  let section = "";
  for (const line of referenceRaw.ini.lines) {
    if (line.type === "section") {
      section = line.name;
      continue;
    }
    if (line.type !== "pair") continue;
    map.set(`${section}${REFERENCE_SEPARATOR}${line.key}`, line.value);
  }
  return map;
}

function toDocument(
  raw: IniFileLoaderRaw,
  roles: { role: string }[],
  targetLocale: string,
): TranslationDocument {
  const translationIndex = findRoleIndex(roles, "translation");
  const translation = translationIndex >= 0 ? raw[translationIndex] : undefined;
  if (!translation) {
    throw new Error("Generic ini Game Loader requires a translation file.");
  }
  const referenceIndex = findRoleIndex(roles, "reference");
  const referenceMap = buildReferenceMap(referenceIndex >= 0 ? raw[referenceIndex] : undefined);

  const identityStrategy = defaultIdentityStrategy();
  const occurrenceCounts = new Map<string, number>();
  const nodes: DocumentNode[] = [];
  let currentSection = "";

  for (const line of translation.ini.lines) {
    if (line.type === "section") {
      currentSection = line.name;
      nodes.push({ type: "section", raw: line.raw, name: line.name });
      continue;
    }
    if (line.type === "blank") {
      nodes.push({ type: "blank", raw: line.raw });
      continue;
    }
    if (line.type === "comment") {
      nodes.push({ type: "comment", raw: line.raw });
      continue;
    }

    const { key, value } = line;
    const identity = `${currentSection}${REFERENCE_SEPARATOR}${key}`;
    const occurrence = occurrenceCounts.get(identity) ?? 0;
    occurrenceCounts.set(identity, occurrence + 1);

    // requiredFiles marks "reference" required — the dropzone won't let a
    // translator proceed without one, since a bare key=value format has no
    // other way to carry the original text. This per-key fallback only
    // covers key drift between the two files (or direct toDocument() calls
    // that skip the reference role, e.g. in tests) — not a supported
    // reference-less workflow.
    const referenceValue = referenceMap.get(identity);
    const source = referenceValue ?? value;
    const ext: GenericIniEntryExt = { hasReference: referenceValue !== undefined };

    nodes.push({
      type: "entry",
      entry: {
        id: identityStrategy.makeEntryId(currentSection || undefined, key, occurrence),
        namespace: currentSection || undefined,
        key,
        source,
        target: value,
        status: statusFromTarget(value),
        ext,
      },
    });
  }

  const lastLine = translation.ini.lines[translation.ini.lines.length - 1];
  const formatMeta: GenericIniFormatMeta = {
    eol: translation.ini.eol,
    trailingNewline: lastLine ? lastLine.eol !== "" : false,
  };

  return {
    gameLoaderId: "generic-ini",
    fileLoaderId: "ini",
    sourceLocale: "und",
    targetLocale,
    nodes,
    formatMeta,
    gameMeta: { translationFileName: translation.name },
  };
}

function fromDocument(doc: TranslationDocument): IniFileLoaderRaw {
  const meta = readFormatMeta(doc);
  const lines: IniLine[] = doc.nodes.map((node, index) => {
    const isLast = index === doc.nodes.length - 1;
    const eol: LineEol = isLast ? (meta.trailingNewline ? meta.eol : "") : meta.eol;

    if (node.type === "entry") {
      const { entry } = node;
      return {
        type: "pair",
        raw: `${entry.key}=${entry.target}`,
        key: entry.key,
        value: entry.target,
        eol,
      };
    }
    if (node.type === "section") return { type: "section", raw: node.raw, name: node.name, eol };
    if (node.type === "comment") return { type: "comment", raw: node.raw, eol };
    if (node.type === "blank") return { type: "blank", raw: node.raw, eol };
    throw new Error(`Generic ini Game Loader does not support "${node.type}" nodes.`);
  });

  const name =
    typeof doc.gameMeta.translationFileName === "string"
      ? doc.gameMeta.translationFileName
      : "translation.ini";
  return [{ name, ini: { eol: meta.eol, lines } }];
}

function detectGame(input: FileLoaderInput): number {
  return Number(iniFileLoader.detect(input));
}

function entryUiHints(entry: TranslationEntry): EntryUiHints {
  const ext = entry.ext as GenericIniEntryExt;
  return ext.hasReference ? { referenceText: entry.source } : {};
}

/** Target-only — no markedSame concept, so patch.markedSame is silently ignored if ever passed. */
function applyEntryPatch(entry: TranslationEntry, patch: EntryPatch): TranslationEntry {
  if (patch.target === undefined) return entry;
  const target = patch.target;
  return { ...entry, target, status: statusFromTarget(target) };
}

const requiredFiles: RequiredFile[] = [
  {
    role: "translation",
    labelKey: "genericIni.dropzone.translation",
    required: true,
    accept: iniFileLoader.extensions,
  },
  {
    role: "reference",
    labelKey: "genericIni.dropzone.reference",
    required: true,
    accept: iniFileLoader.extensions,
  },
];

export const genericIniGameLoader: GameLoader<IniFileLoaderRaw> = {
  id: "generic-ini",
  displayName: "Generic ini/cfg",
  icon: "generic",
  fileLoaderId: "ini",
  fileExtension: ".ini",
  requiredFiles,
  detectGame,
  toDocument,
  fromDocument,
  entryUiHints,
  applyEntryPatch,
  placeholders: { tokenize: () => [] },
  statusStrategy: {
    fromNative: (entry) => statusFromTarget(entry.target),
    toNative: () => "none",
  },
  locale: {},
};
