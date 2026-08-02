import { classifyNonEntryLine } from "@/core/lang/parse";
import type { LangLine } from "@/core/lang/markers";

export const PROGRESS_STORAGE_KEY = "necesse_lang_translator_v1";

const FLAG_SAME = 1;
const FLAG_MISSING = 2;
const FLAG_MT = 4;
const FLAG_TOUCHED = 8;

export interface WorkspaceSnapshotMeta {
  provider: string;
  targetLanguage: string;
  spellcheck: boolean;
  autocompleteEnabled: boolean;
}

export interface WorkspaceSnapshot {
  filename: string;
  referenceFilename: string;
  eol: "\n" | "\r\n";
  savedAt: number;
  items: LangLine[];
  meta: WorkspaceSnapshotMeta;
}

export interface ProgressDocumentV2 {
  v: 2;
  f: string;
  e: 0 | 1;
  s: number;
  n: string;
  m: { p: string; t: string; s: 0 | 1; a: 0 | 1 };
  i: Array<string | Array<unknown>>;
}

export function serializeProgress(snapshot: WorkspaceSnapshot): ProgressDocumentV2 {
  const rows = snapshot.items.map((item) => {
    if (item.type !== "entry") return item.raw || "";
    let flags = 0;
    if (item.markedSame) flags |= FLAG_SAME;
    if (item.wasMissing) flags |= FLAG_MISSING;
    if (item.mtDraft) flags |= FLAG_MT;
    if (item.touched) flags |= FLAG_TOUCHED;
    const row: unknown[] = [item.key, item.value, flags];
    const needsEnglish = item.english !== item.value;
    const hasReference = item.ref != null;
    if (needsEnglish || hasReference) row.push(needsEnglish ? item.english : 0);
    if (hasReference) row.push(item.ref);
    return row;
  });

  return {
    v: 2,
    f: snapshot.filename,
    e: snapshot.eol === "\r\n" ? 1 : 0,
    s: Date.now(),
    n: snapshot.referenceFilename || "",
    m: {
      p: snapshot.meta.provider,
      t: snapshot.meta.targetLanguage,
      s: snapshot.meta.spellcheck ? 1 : 0,
      a: snapshot.meta.autocompleteEnabled ? 1 : 0,
    },
    i: rows,
  };
}

export function deserializeProgress(data: unknown): WorkspaceSnapshot {
  if (!data || typeof data !== "object") throw new Error("Unknown progress format");
  const document = data as Record<string, unknown>;
  if (document.v === 2) return deserializeV2(document);
  if (Array.isArray(document.items)) return deserializeV1(document);
  throw new Error("Unknown progress format");
}

function deserializeV2(document: Record<string, unknown>): WorkspaceSnapshot {
  const meta = (document.m as Record<string, unknown>) || {};
  const filename = String(document.f || "");
  const items = ((document.i as unknown[]) || []).map((row, index) => {
    if (!Array.isArray(row)) return classifyNonEntryLine(String(row));
    const [key, value, flags, englishOrZero, referenceValue] = row as [
      string,
      string,
      number,
      unknown?,
      string?,
    ];
    const entry: LangLine = {
      type: "entry",
      id: index,
      key,
      value,
      english: englishOrZero === 0 || englishOrZero === undefined ? value : String(englishOrZero),
      markedSame: !!(flags & FLAG_SAME),
      wasMissing: !!(flags & FLAG_MISSING),
      mtDraft: !!(flags & FLAG_MT),
      touched: !!(flags & FLAG_TOUCHED),
    };
    if (referenceValue != null) entry.ref = String(referenceValue);
    return entry;
  });

  return {
    filename,
    referenceFilename: String(document.n || ""),
    eol: document.e ? "\r\n" : "\n",
    savedAt: Number(document.s || 0),
    items,
    meta: {
      provider: String(meta.p || "google"),
      targetLanguage: String(meta.t || ""),
      spellcheck: meta.s !== 0,
      autocompleteEnabled: meta.a !== 0,
    },
  };
}

function deserializeV1(document: Record<string, unknown>): WorkspaceSnapshot {
  const mt = (document.mt as Record<string, unknown>) || {};
  const rawItems = document.items as Array<Record<string, unknown>>;
  const items = rawItems.map((row, index): LangLine => {
    if (row.t === "e") {
      return {
        type: "entry",
        id: index,
        key: String(row.key || ""),
        english: String(row.english || ""),
        value: String(row.value || ""),
        markedSame: !!row.markedSame,
        wasMissing: !!row.wasMissing,
        mtDraft: !!row.mtDraft,
        touched: !!row.touched,
        ref: row.ref != null ? String(row.ref) : undefined,
      };
    }
    return classifyNonEntryLine(String(row.raw || ""));
  });

  return {
    filename: String(document.filename || ""),
    referenceFilename: String(document.referenceFilename || ""),
    eol: (document.eol as "\n" | "\r\n") || "\r\n",
    savedAt: Number(document.savedAt || 0),
    items,
    meta: {
      provider: String(mt.provider || "google"),
      targetLanguage: String(mt.target || ""),
      spellcheck: mt.spell !== false,
      autocompleteEnabled: mt.ac !== false,
    },
  };
}

export function saveProgressToLocalStorage(snapshot: WorkspaceSnapshot): boolean {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(serializeProgress(snapshot)));
    return true;
  } catch {
    return false;
  }
}

export function loadProgressFromLocalStorage(): WorkspaceSnapshot | null {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    return deserializeProgress(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearProgressFromLocalStorage() {
  try {
    localStorage.removeItem(PROGRESS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
