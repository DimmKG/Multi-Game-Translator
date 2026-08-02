import type { EntryStatus, LangLine } from "./markers";

export type TranslationEntry = Extract<LangLine, { type: "entry" }>;

/** Source text used for token/whitespace checks and MT. */
export function referenceSource(entry: TranslationEntry): string | null {
  if (entry.ref != null) return entry.ref;
  if (entry.wasMissing) return entry.english;
  return null;
}

export function sourceText(entry: TranslationEntry): string {
  const source = referenceSource(entry);
  return source != null ? source : entry.english;
}

/**
 * Derived UI status.
 * SAME_TRANSLATION is only a verifiable "same" status when a reference is matched.
 */
export function statusOf(entry: TranslationEntry): EntryStatus {
  if (entry.markedSame && entry.ref != null) return "same";
  if (entry.wasMissing) {
    if (entry.value.trim() === "" || entry.value === entry.english) return "missing";
    return "done";
  }
  if (entry.value.trim() === "") return "missing";
  return "done";
}

export function hasUsableReference(items: LangLine[], referenceFilename: string): boolean {
  return (
    Boolean(referenceFilename) && items.some((item) => item.type === "entry" && item.ref != null)
  );
}

export function countProgress(items: LangLine[]): { done: number; total: number } {
  let total = 0;
  let done = 0;
  for (const item of items) {
    if (item.type !== "entry") continue;
    total += 1;
    if (statusOf(item) !== "missing") done += 1;
  }
  return { done, total };
}
