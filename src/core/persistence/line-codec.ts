// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LangLine } from "@/core/lang/markers";
import type { RowIndex } from "./row-index";

/** Internal IndexedDB line record — not the external ProgressDocumentV2 row. */
export type StoredLine =
  | {
      id: number;
      kind: "raw";
      type: "blank" | "comment" | "section";
      raw: string;
      name?: string;
    }
  | {
      id: number;
      kind: "entry";
      key: string;
      value: string;
      markedSame: boolean;
      wasMissing: boolean;
      touched: boolean;
      mtDraft: boolean;
      /** Explicit: false means no English reference matched for this row. */
      hasRef: boolean;
      /** Omitted when equal to value (and especially when hasRef is false). */
      english?: string;
      /** Present only when hasRef is true. */
      ref?: string;
      idx: RowIndex;
    };

export function encodeLine(item: LangLine, index: number, rowIndex?: RowIndex): StoredLine {
  if (item.type !== "entry") {
    if (item.type === "section") {
      return { id: index, kind: "raw", type: "section", raw: item.raw, name: item.name };
    }
    return { id: index, kind: "raw", type: item.type, raw: item.raw };
  }

  const hasRef = item.ref != null;
  const record: StoredLine = {
    id: index,
    kind: "entry",
    key: item.key,
    value: item.value,
    markedSame: item.markedSame,
    wasMissing: item.wasMissing,
    touched: item.touched,
    mtDraft: !!item.mtDraft,
    hasRef,
    idx:
      rowIndex ??
      ({
        status: "done",
        tokenIssue: false,
        wsIssue: false,
        glossaryIssue: false,
        hasRef,
      } satisfies RowIndex),
  };

  // Do not store same-language text as a faux original when there is no reference.
  if (item.english !== item.value) {
    record.english = item.english;
  }
  if (hasRef) {
    record.ref = item.ref;
  }

  return record;
}

export function decodeLine(record: StoredLine): LangLine {
  if (record.kind === "raw") {
    if (record.type === "section") {
      return { type: "section", raw: record.raw, name: record.name || record.raw };
    }
    return { type: record.type, raw: record.raw };
  }

  const entry: LangLine = {
    type: "entry",
    id: record.id,
    key: record.key,
    value: record.value,
    english: record.english !== undefined ? record.english : record.value,
    markedSame: record.markedSame,
    wasMissing: record.wasMissing,
    touched: record.touched,
    mtDraft: record.mtDraft,
  };
  if (record.hasRef && record.ref != null) {
    entry.ref = record.ref;
  }
  return entry;
}
