// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  defaultIdentityStrategy,
  type DocumentNode,
  type FileLoaderInput,
  type GameLoader,
  type IniFileLoaderRaw,
  type IniLine,
  type LineEol,
  type RequiredFile,
  type TranslationDocument,
  type TranslationEntry,
} from "@mgt/sdk";
import { MISSING_TRANSLATION_PREFIX, SAME_TRANSLATION_PREFIX, stripStatusPrefix } from "./markers";
import { necessePlaceholderTokenizer } from "./placeholders";
import { buildReferenceQueues, referenceIdentity } from "./reference";
import { necesseStatusStrategy, type NecesseEntryExt } from "./status";
import { validateEnglishReferenceFile } from "./validate-reference";

type NecesseFormatMeta = {
  eol: "\n" | "\r\n";
  /** Whether the source translation file's last line had a trailing newline. */
  trailingNewline: boolean;
};

function findRoleIndex(roles: { role: string }[], role: string): number {
  return roles.findIndex((entry) => entry.role === role);
}

function toDocument(raw: IniFileLoaderRaw, roles: { role: string }[]): TranslationDocument {
  const translationIndex = findRoleIndex(roles, "translation");
  const translation = translationIndex >= 0 ? raw[translationIndex] : undefined;
  if (!translation) {
    throw new Error("Necesse Game Loader requires a translation file.");
  }
  const referenceIndex = findRoleIndex(roles, "reference");
  const referenceFile = referenceIndex >= 0 ? raw[referenceIndex] : undefined;
  const referenceQueues = referenceFile
    ? buildReferenceQueues(referenceFile.ini)
    : new Map<string, string[]>();

  const occurrenceCounts = new Map<string, number>();
  const identityStrategy = defaultIdentityStrategy();
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

    const { key, markedSame, wasMissing } = stripStatusPrefix(line.key);
    const originalValue = line.value;
    const identity = referenceIdentity(currentSection, key);
    const occurrence = occurrenceCounts.get(identity) ?? 0;
    occurrenceCounts.set(identity, occurrence + 1);

    const queue = referenceQueues.get(identity);
    const ref = queue && occurrence < queue.length ? queue[occurrence] : undefined;

    const source = ref ?? originalValue;
    const target = originalValue;
    const ext: NecesseEntryExt = {
      markedSame,
      wasMissing,
      originalValue,
      hasReference: ref !== undefined,
    };

    const entry: TranslationEntry = {
      id: identityStrategy.makeEntryId(currentSection || undefined, key, occurrence),
      namespace: currentSection || undefined,
      key,
      source,
      target,
      status: "missing",
      ext,
    };
    entry.status = necesseStatusStrategy.fromNative(entry, {
      markedSame,
      wasMissing,
      hasReference: ref !== undefined,
    });
    nodes.push({ type: "entry", entry });
  }

  const lastLine = translation.ini.lines[translation.ini.lines.length - 1];
  const formatMeta: NecesseFormatMeta = {
    eol: translation.ini.eol,
    trailingNewline: lastLine ? lastLine.eol !== "" : false,
  };

  return {
    gameLoaderId: "necesse",
    fileLoaderId: "ini",
    sourceLocale: "en",
    targetLocale: "",
    nodes,
    formatMeta,
    gameMeta: {},
  };
}

function fromDocument(doc: TranslationDocument): IniFileLoaderRaw {
  const meta = doc.formatMeta as NecesseFormatMeta;
  const lines: IniLine[] = doc.nodes.map((node, index) => {
    const isLast = index === doc.nodes.length - 1;
    const eol: LineEol = isLast ? (meta.trailingNewline ? meta.eol : "") : meta.eol;

    if (node.type === "entry") {
      const { entry } = node;
      const marker = necesseStatusStrategy.toNative(entry, entry.status);
      const prefix =
        marker === "same"
          ? SAME_TRANSLATION_PREFIX
          : marker === "missing"
            ? MISSING_TRANSLATION_PREFIX
            : "";
      const key = `${prefix}${entry.key}`;
      return { type: "pair", raw: `${key}=${entry.target}`, key, value: entry.target, eol };
    }
    if (node.type === "section") return { type: "section", raw: node.raw, name: node.name, eol };
    if (node.type === "comment") return { type: "comment", raw: node.raw, eol };
    if (node.type === "blank") return { type: "blank", raw: node.raw, eol };
    throw new Error(`Necesse Game Loader does not support "${node.type}" nodes.`);
  });

  return [{ name: "translation.lang", ini: { eol: meta.eol, lines } }];
}

function detectGame(input: FileLoaderInput): number {
  if (!input.files.length) return 0;
  let total = 0;
  for (const file of input.files) {
    const text = file.text ?? "";
    let score = /\.lang$/i.test(file.name) ? 0.5 : 0;
    if (text.includes(MISSING_TRANSLATION_PREFIX) || text.includes(SAME_TRANSLATION_PREFIX)) {
      score += 0.3;
    }
    if (/^\s*engname\s*=/m.test(text)) score += 0.2;
    total += Math.min(score, 1);
  }
  return total / input.files.length;
}

const requiredFiles: RequiredFile[] = [
  {
    role: "reference",
    labelKey: "necesse.dropzone.reference",
    required: true,
    accept: [".lang"],
    validate(file) {
      const result = validateEnglishReferenceFile(file.name, file.text);
      return result.ok ? { ok: true } : { ok: false, messageKey: result.messageKey };
    },
  },
  {
    role: "translation",
    labelKey: "necesse.dropzone.translation",
    required: true,
    accept: [".lang"],
  },
];

export const necesseGameLoader: GameLoader<IniFileLoaderRaw> = {
  id: "necesse",
  displayName: "Necesse",
  fileLoaderId: "ini",
  requiredFiles,
  detectGame,
  toDocument,
  fromDocument,
  placeholders: necessePlaceholderTokenizer,
  statusStrategy: necesseStatusStrategy,
  locale: {},
};
