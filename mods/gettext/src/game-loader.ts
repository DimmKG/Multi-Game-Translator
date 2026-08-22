// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  bridgeGettextToCldr,
  buildPoText,
  createCldrPluralSelector,
  defaultIdentityStrategy,
  defaultLoaderConfig,
  parsePluralForms,
  parsePoText,
  poFileLoader,
  poMessageFlags,
  TRANSLATION_ROLE,
  type DocumentNode,
  type EntryPatch,
  type EntryStatus,
  type GameLoader,
  type LoaderConfigField,
  type LoaderConfigValues,
  type PluralCategory,
  type PoCommentLine,
  type PoFileLoaderRaw,
  type PoFileRaw,
  type PoMessage,
  type RequiredFile,
  type TranslationDocument,
  type TranslationEntry,
} from "@mgt/sdk";
import { gettextPlaceholderTokenizer } from "./placeholders";

/**
 * Original comments a message carried, preserved for round-trip and for
 * toggling the "fuzzy" flag. `contextSwapped` records, per entry, whether
 * `configSchema`'s "contextAsKey" was actually applied to *this* message
 * (only true when it had a msgctxt to swap in) — fromDocument un-swaps by
 * this flag rather than re-deriving it from doc-level config, since a mixed
 * file can have some messages with msgctxt and others without.
 */
type GettextEntryExt = { comments: PoCommentLine[]; contextSwapped: boolean };

const CONFIG_SCHEMA: LoaderConfigField[] = [
  {
    key: "contextAsKey",
    type: "boolean",
    labelKey: "gettext.config.contextAsKey",
    hintKey: "gettext.config.contextAsKeyHint",
    default: false,
  },
];

/** Occurrence-counting key separator — never collides with a real msgctxt/msgid. */
const IDENTITY_SEPARATOR = String.fromCharCode(0);

function findRoleIndex(roles: { role: string }[], role: string): number {
  return roles.findIndex((entry) => entry.role === role);
}

function computeStatus(msgstr: string[], fuzzy: boolean): EntryStatus {
  const hasContent = msgstr.some((value) => value.trim() !== "");
  if (!hasContent) return "missing";
  return fuzzy ? "draft" : "translated";
}

/**
 * Toggles the "fuzzy" flag within a message's existing flag-kind comment
 * (adding one if none exists, dropping an emptied flag comment entirely),
 * leaving every other flag and comment untouched. Assumes at most one
 * flag-kind ("#,") comment line per message, which is what real .po output
 * uses in practice.
 */
function setFuzzy(comments: PoCommentLine[], fuzzy: boolean): PoCommentLine[] {
  const flagIndex = comments.findIndex((comment) => comment.kind === "flag");
  if (!fuzzy) {
    if (flagIndex === -1) return comments;
    const flags = comments[flagIndex].text
      .split(",")
      .map((flag) => flag.trim())
      .filter((flag) => flag && flag !== "fuzzy");
    const next = [...comments];
    if (flags.length) next[flagIndex] = { kind: "flag", text: ` ${flags.join(", ")}` };
    else next.splice(flagIndex, 1);
    return next;
  }
  if (flagIndex === -1) return [...comments, { kind: "flag", text: " fuzzy" }];
  const flags = comments[flagIndex].text
    .split(",")
    .map((flag) => flag.trim())
    .filter(Boolean);
  if (flags.includes("fuzzy")) return comments;
  const next = [...comments];
  next[flagIndex] = { kind: "flag", text: ` ${[...flags, "fuzzy"].join(", ")}` };
  return next;
}

/**
 * Obsolete ("#~") messages don't become editable entries — collapsed into a
 * single multi-line comment node instead, reusing buildPoText/parsePoText
 * (with an empty header, so only the one message's paragraph is produced)
 * rather than duplicating paragraph-formatting logic.
 */
function obsoleteMessageToRaw(message: PoMessage, eol: "\n" | "\r\n"): string {
  return buildPoText({
    eol,
    trailingNewline: false,
    header: { fields: {}, comments: [] },
    messages: [message],
  });
}

function rawToObsoleteMessage(raw: string, eol: "\n" | "\r\n"): PoMessage | undefined {
  return parsePoText(raw + eol).messages[0];
}

function toDocument(
  raw: PoFileLoaderRaw,
  roles: { role: string }[],
  targetLocale: string,
  config?: LoaderConfigValues,
): TranslationDocument {
  const translationIndex = findRoleIndex(roles, TRANSLATION_ROLE);
  const translation = translationIndex >= 0 ? raw[translationIndex] : undefined;
  if (!translation) {
    throw new Error("gettext Game Loader requires a translation file.");
  }
  const po = translation.po;
  const { spec } = parsePluralForms(po.header.fields["Plural-Forms"]);
  const gettextToCldr = bridgeGettextToCldr(spec, targetLocale);
  const resolvedConfig = { ...defaultLoaderConfig(CONFIG_SCHEMA), ...config };
  const contextAsKey = resolvedConfig.contextAsKey === true;

  const identityStrategy = defaultIdentityStrategy();
  const occurrenceCounts = new Map<string, number>();
  const nodes: DocumentNode[] = [];

  const hasHeader = Object.keys(po.header.fields).length > 0 || po.header.comments.length > 0;
  if (hasHeader) nodes.push({ type: "header", fields: po.header.fields });

  for (const message of po.messages) {
    if (message.obsolete) {
      nodes.push({ type: "comment", raw: obsoleteMessageToRaw(message, po.eol) });
      continue;
    }

    const identity = `${message.msgctxt ?? ""}${IDENTITY_SEPARATOR}${message.msgid}`;
    const occurrence = occurrenceCounts.get(identity) ?? 0;
    occurrenceCounts.set(identity, occurrence + 1);

    const isPlural = message.msgidPlural !== undefined;
    const fuzzy = poMessageFlags(message).includes("fuzzy");
    const status = computeStatus(message.msgstr, fuzzy);
    // Weblate/Kodi-style .po: msgctxt is a stable string ID ("#30000"), msgid
    // is the actual English text — the reverse of plain gettext, where msgid
    // alone is both key and source. Only swap when there's a msgctxt to swap
    // in; entry.source stays msgid always, since that's the real text every
    // placeholder/whitespace/terminology check needs to compare against.
    const contextSwapped = contextAsKey && Boolean(message.msgctxt);
    const ext: GettextEntryExt = { comments: message.comments, contextSwapped };

    let sourcePlurals: Partial<Record<PluralCategory, string>> | undefined;
    let targetPlurals: Partial<Record<PluralCategory, string>> | undefined;
    let target = message.msgstr[0] ?? "";

    if (isPlural) {
      sourcePlurals = { one: message.msgid, other: message.msgidPlural };
      targetPlurals = {};
      for (let gettextIndex = 0; gettextIndex < spec.nplurals; gettextIndex++) {
        const category = gettextToCldr[gettextIndex];
        targetPlurals[category] = message.msgstr[gettextIndex] ?? "";
      }
      // Flat fallback for consumers with no plural-aware editor widget yet.
      target =
        targetPlurals.other ??
        Object.values(targetPlurals).find((value) => value !== undefined) ??
        "";
    }

    const entry: TranslationEntry = {
      id: identityStrategy.makeEntryId(message.msgctxt, message.msgid, occurrence),
      namespace: contextSwapped ? message.msgid : message.msgctxt,
      key: contextSwapped ? message.msgctxt! : message.msgid,
      source: message.msgid,
      target,
      status,
      ext,
      ...(sourcePlurals ? { sourcePlurals } : {}),
      ...(targetPlurals ? { targetPlurals } : {}),
    };
    nodes.push({ type: "entry", entry });
  }

  return {
    gameLoaderId: "gettext",
    fileLoaderId: "po",
    sourceLocale: "en",
    targetLocale,
    nodes,
    formatMeta: { eol: po.eol, trailingNewline: po.trailingNewline },
    gameMeta: { translationFileName: translation.name, loaderConfig: resolvedConfig },
  };
}

function fromDocument(doc: TranslationDocument): PoFileLoaderRaw {
  const eol = doc.formatMeta.eol === "\r\n" ? "\r\n" : "\n";
  const trailingNewline = doc.formatMeta.trailingNewline === true;
  const headerNode = doc.nodes.find(
    (node): node is Extract<DocumentNode, { type: "header" }> => node.type === "header",
  );
  const headerFields = headerNode?.fields ?? {};
  const { spec } = parsePluralForms(headerFields["Plural-Forms"]);
  const gettextToCldr = bridgeGettextToCldr(spec, doc.targetLocale);

  const messages: PoMessage[] = [];
  for (const node of doc.nodes) {
    if (node.type === "comment") {
      // gettext's toDocument only ever emits comment nodes for obsolete
      // blocks — safe to always round-trip them back the same way.
      const message = rawToObsoleteMessage(node.raw, eol);
      if (message) messages.push(message);
      continue;
    }
    if (node.type !== "entry") continue;
    const { entry } = node;
    const ext = entry.ext as GettextEntryExt;
    const isPlural = entry.sourcePlurals !== undefined;

    let msgstr: string[];
    let msgidPlural: string | undefined;
    if (isPlural) {
      msgidPlural = entry.sourcePlurals?.other;
      const targetPlurals = entry.targetPlurals ?? {};
      msgstr = [];
      for (let gettextIndex = 0; gettextIndex < spec.nplurals; gettextIndex++) {
        const category = gettextToCldr[gettextIndex];
        msgstr.push(targetPlurals[category] ?? "");
      }
    } else {
      msgstr = [entry.target];
    }

    messages.push({
      comments: ext.comments,
      obsolete: false,
      // entry.source is always the real msgid regardless of contextSwapped
      // (toDocument never swaps it); only msgctxt's home (key vs namespace)
      // depends on whether *this* entry had it swapped in.
      msgctxt: ext.contextSwapped ? entry.key : entry.namespace,
      msgid: entry.source,
      msgidPlural,
      msgstr,
    });
  }

  const name =
    typeof doc.gameMeta.translationFileName === "string"
      ? doc.gameMeta.translationFileName
      : "translation.po";
  // Header-level leading comments (e.g. a license block) aren't modeled by
  // the SDK's {type:"header", fields} node — a documented scope cut, not a
  // silent loss: only the header's Key: value fields round-trip.
  const po: PoFileRaw = {
    eol,
    trailingNewline,
    header: { fields: headerFields, comments: [] },
    messages,
  };
  return [{ name, po }];
}

/**
 * PO is single-file (msgid already IS the source) — the SDK's generic
 * createDraftFromReference doesn't apply (see its own doc comment excluding
 * gettext explicitly). Blanks every msgstr slot and clears fuzzy from a
 * .po/.pot template, then feeds it straight through toDocument.
 */
function createFromReference(
  referenceRaw: PoFileLoaderRaw,
  targetLocale: string,
  config?: LoaderConfigValues,
): TranslationDocument {
  const referenceEntry = referenceRaw[0];
  if (!referenceEntry) {
    throw new Error("gettextGameLoader.createFromReference requires a reference file.");
  }
  const draftMessages: PoMessage[] = referenceEntry.po.messages.map((message) => ({
    ...message,
    msgstr: message.msgstr.map(() => ""),
    comments: setFuzzy(message.comments, false),
  }));
  const draftPo: PoFileRaw = { ...referenceEntry.po, messages: draftMessages };
  return toDocument(
    [{ name: referenceEntry.name, po: draftPo }],
    [{ role: TRANSLATION_ROLE }],
    targetLocale,
    config,
  );
}

function detectGame(input: {
  files: Array<{ name: string; text?: string; bytes?: Uint8Array }>;
}): number {
  return Number(poFileLoader.detect(input));
}

/**
 * A target edit also clears "fuzzy": real gettext tooling (Poedit, Lokalize,
 * msgmerge-adjacent workflows) treats a translator actually touching the
 * text as confirming it, and there's no separate "toggle fuzzy" action in
 * EntryPatch for the translator to use instead.
 */
function applyEntryPatch(entry: TranslationEntry, patch: EntryPatch): TranslationEntry {
  const ext = entry.ext as GettextEntryExt;

  if (patch.targetPluralCategory) {
    const { category, value } = patch.targetPluralCategory;
    const targetPlurals = { ...entry.targetPlurals, [category]: value };
    const target =
      targetPlurals.other ?? Object.values(targetPlurals).find((v) => v !== undefined) ?? "";
    const status = computeStatus(
      Object.values(targetPlurals).filter((v): v is string => v !== undefined),
      false,
    );
    return {
      ...entry,
      target,
      targetPlurals,
      status,
      ext: { ...ext, comments: setFuzzy(ext.comments, false) },
    };
  }

  if (patch.target === undefined) return entry;
  const isPlural = entry.sourcePlurals !== undefined;
  const target = patch.target;
  const targetPlurals = isPlural ? { ...entry.targetPlurals, other: target } : entry.targetPlurals;
  const msgstrValues = isPlural ? Object.values(targetPlurals ?? {}) : [target];
  const status = computeStatus(
    msgstrValues.filter((value): value is string => value !== undefined),
    false,
  );
  return {
    ...entry,
    target,
    ...(isPlural ? { targetPlurals } : {}),
    status,
    ext: { ...ext, comments: setFuzzy(ext.comments, false) },
  };
}

const requiredFiles: RequiredFile[] = [
  {
    role: TRANSLATION_ROLE,
    labelKey: "gettext.dropzone.translation",
    required: true,
    accept: poFileLoader.extensions,
  },
  {
    role: "template",
    labelKey: "gettext.dropzone.template",
    required: false,
    accept: poFileLoader.extensions,
  },
];

export const gettextGameLoader: GameLoader<PoFileLoaderRaw> = {
  id: "gettext",
  displayName: "gettext (.po)",
  fileLoaderId: "po",
  fileExtension: ".po",
  requiredFiles,
  configSchema: CONFIG_SCHEMA,
  detectGame,
  toDocument,
  fromDocument,
  createFromReference,
  applyEntryPatch,
  placeholders: gettextPlaceholderTokenizer,
  pluralSelector: createCldrPluralSelector(),
  statusStrategy: {
    fromNative: (entry) => entry.status,
    toNative: () => "none",
  },
  locale: {},
};
