// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IniRaw } from "@mgt/sdk";
import { stripStatusPrefix } from "./markers";

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
