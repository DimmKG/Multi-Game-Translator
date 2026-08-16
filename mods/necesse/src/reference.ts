// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IniFileLoaderRaw, IniRaw, TranslationDocument } from "@mgt/sdk";
import { stripStatusPrefix } from "./markers";
import { necesseEntryExt, necesseStatusStrategy, type NecesseEntryExt } from "./status";

/** namespace\0key — stable identity for matching target entries against a reference file. */
export function referenceIdentity(namespace: string, key: string): string {
  return `${namespace}\0${key}`;
}

/**
 * Indexes a reference `.lang` file by namespace+key, queuing values in file
 * order so duplicate keys within one section are matched by occurrence —
 * same semantics as today's parseReferenceLang.
 */
export function buildReferenceQueues(referenceIni: IniRaw): Map<string, string[]> {
  const queues = new Map<string, string[]>();
  let currentSection = "";
  for (const line of referenceIni.lines) {
    if (line.type === "section") {
      currentSection = line.name;
      continue;
    }
    if (line.type !== "pair") continue;
    const { key } = stripStatusPrefix(line.key);
    const identity = referenceIdentity(currentSection, key);
    const queue = queues.get(identity);
    if (queue) queue.push(line.value);
    else queues.set(identity, [line.value]);
  }
  return queues;
}

/**
 * Attaches or replaces the reference match on an already-open document —
 * pure document-in/document-out, no host/UI concerns (toasts, match counts
 * for display live in the host, derived generically from the result).
 * Moved from src/state/workspace-store.tsx's loadReferenceFile.
 */
export function necesseAttachReference(
  document: TranslationDocument,
  referenceRaw: IniFileLoaderRaw,
): TranslationDocument {
  const referenceEntry = referenceRaw[0];
  const queues = referenceEntry
    ? buildReferenceQueues(referenceEntry.ini)
    : new Map<string, string[]>();
  const occurrenceCounts = new Map<string, number>();
  const nodes = document.nodes.map((node) => {
    if (node.type !== "entry") return node;
    const { entry } = node;
    const ext = necesseEntryExt(entry);
    const identity = referenceIdentity(entry.namespace || "", entry.key);
    const occurrence = occurrenceCounts.get(identity) ?? 0;
    occurrenceCounts.set(identity, occurrence + 1);
    const queue = queues.get(identity);
    const ref = queue && occurrence < queue.length ? queue[occurrence] : undefined;
    const nextExt: NecesseEntryExt = { ...ext, hasReference: ref !== undefined };
    const nextEntry = { ...entry, source: ref ?? ext.originalValue, ext: nextExt };
    const status = necesseStatusStrategy.fromNative(nextEntry, {
      markedSame: nextExt.markedSame,
      wasMissing: nextExt.wasMissing,
      hasReference: nextExt.hasReference,
    });
    return { ...node, entry: { ...nextEntry, status } };
  });
  return { ...document, nodes };
}
