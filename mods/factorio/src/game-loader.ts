// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  defaultIdentityStrategy,
  iniFileLoader,
  REFERENCE_ROLE,
  TRANSLATION_ROLE,
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
import { factorioPlaceholderTokenizer } from "./placeholders";

type FactorioFormatMeta = {
  eol: "\n" | "\r\n";
  /** Whether the source translation file's last line had a trailing newline. */
  trailingNewline: boolean;
};

/** Only tracked native fact: did this entry's source come from a matched reference. No native "untranslated" marker exists in Factorio's format. */
type FactorioEntryExt = { hasReference: boolean };

/** Same null-byte join convention as defaultIdentityStrategy — never collides with a real section/key name. */
const REFERENCE_SEPARATOR = String.fromCharCode(0);

/** No native marker to round-trip — status is derived purely from whether target is empty, same situation as generic-ini. */
function statusFromTarget(target: string): "missing" | "translated" {
  return target.trim() === "" ? "missing" : "translated";
}

function findRoleIndex(roles: { role: string }[], role: string): number {
  return roles.findIndex((entry) => entry.role === role);
}

function readFormatMeta(doc: TranslationDocument): FactorioFormatMeta {
  const meta = doc.formatMeta;
  const eol = meta.eol;
  const trailingNewline = meta.trailingNewline;
  if ((eol !== "\n" && eol !== "\r\n") || typeof trailingNewline !== "boolean") {
    throw new TypeError(
      "TranslationDocument.formatMeta is missing valid Factorio fields (eol/trailingNewline) — was this document produced by factorioGameLoader.toDocument()?",
    );
  }
  return { eol, trailingNewline };
}

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
  const translationIndex = findRoleIndex(roles, TRANSLATION_ROLE);
  const translation = translationIndex >= 0 ? raw[translationIndex] : undefined;
  if (!translation) {
    throw new Error("Factorio Game Loader requires a translation file.");
  }
  const referenceIndex = findRoleIndex(roles, REFERENCE_ROLE);
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

    const referenceValue = referenceMap.get(identity);
    const source = referenceValue ?? value;
    const ext: FactorioEntryExt = { hasReference: referenceValue !== undefined };

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
  const formatMeta: FactorioFormatMeta = {
    eol: translation.ini.eol,
    trailingNewline: lastLine ? lastLine.eol !== "" : false,
  };

  return {
    gameLoaderId: "factorio",
    fileLoaderId: "ini",
    sourceLocale: "en",
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
    throw new Error(`Factorio Game Loader does not support "${node.type}" nodes.`);
  });

  const name =
    typeof doc.gameMeta.translationFileName === "string"
      ? doc.gameMeta.translationFileName
      : "translation.cfg";
  return [{ name, ini: { eol: meta.eol, lines } }];
}

/**
 * Builds a blank TranslationDocument from just a reference file — every
 * entry starts empty (status "missing"). Deliberately NOT the SDK's generic
 * createDraftFromReference: that helper duplicates the reference's own text
 * into the synthetic translation slot (target === source, non-empty), which
 * under statusFromTarget's "empty target = missing" rule would make every
 * freshly-created entry read as "translated" instead — backwards for
 * "start a blank translation" (the same reason generic-ini, same status
 * model, doesn't implement createFromReference at all).
 */
function createFromReference(
  referenceRaw: IniFileLoaderRaw,
  targetLocale: string,
): TranslationDocument {
  const referenceEntry = referenceRaw[0];
  if (!referenceEntry) {
    throw new Error("factorioGameLoader.createFromReference requires a reference file.");
  }
  const draftLines: IniLine[] = referenceEntry.ini.lines.map((line) =>
    line.type === "pair" ? { ...line, value: "", raw: `${line.key}=` } : line,
  );
  const draftEntry = {
    name: referenceEntry.name,
    ini: { eol: referenceEntry.ini.eol, lines: draftLines },
  };
  return toDocument(
    [referenceEntry, draftEntry],
    [{ role: REFERENCE_ROLE }, { role: TRANSLATION_ROLE }],
    targetLocale,
  );
}

function detectGame(input: FileLoaderInput): number {
  if (!input.files.length) return 0;
  let total = 0;
  for (const file of input.files) {
    const text = file.text ?? "";
    let score = /\.cfg$/i.test(file.name) ? 0.3 : 0;
    if (/__\d+__/.test(text)) score += 0.3;
    if (/__plural_for_parameter_\d+_\{/.test(text)) score += 0.4;
    total += Math.min(score, 1);
  }
  return total / input.files.length;
}

function entryUiHints(entry: TranslationEntry): EntryUiHints {
  const ext = entry.ext as FactorioEntryExt;
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
    role: TRANSLATION_ROLE,
    labelKey: "factorio.dropzone.translation",
    required: true,
    accept: iniFileLoader.extensions,
  },
  {
    role: REFERENCE_ROLE,
    labelKey: "factorio.dropzone.reference",
    required: true,
    accept: iniFileLoader.extensions,
  },
];

export const factorioGameLoader: GameLoader<IniFileLoaderRaw> = {
  id: "factorio",
  displayName: "Factorio",
  fileLoaderId: "ini",
  fileExtension: ".cfg",
  requiredFiles,
  detectGame,
  toDocument,
  fromDocument,
  createFromReference,
  entryUiHints,
  applyEntryPatch,
  placeholders: factorioPlaceholderTokenizer,
  statusStrategy: {
    fromNative: (entry) => statusFromTarget(entry.target),
    toNative: () => "none",
  },
  locale: {},
};
