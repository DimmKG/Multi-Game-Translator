// SPDX-License-Identifier: AGPL-3.0-or-later

import type { GlossaryDraftEntry } from "./draft";

export function glossaryValuesFromMultiline(value: string): string[] {
  return value.split(/\r?\n/u).filter((item) => item.length > 0);
}

export function glossaryDraftEntrySearchText(entry: Readonly<GlossaryDraftEntry>): string {
  return [
    entry.source,
    entry.target,
    ...entry.forms,
    ...entry.alternatives,
    ...entry.forbidden,
    entry.status,
    entry.category,
    entry.context,
    entry.note,
  ]
    .join("\n")
    .toLocaleLowerCase();
}
