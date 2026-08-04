// SPDX-License-Identifier: AGPL-3.0-or-later

import type { GlossaryEntry } from "../glossary/matcher";
import type { TerminologyGlossaryLanguageEntries } from "./glossary-entry-export";

export interface MergeableGlossaryDocument {
  sourceLanguage: string;
  targetLanguage: string;
  entries: readonly GlossaryEntry[];
  [key: string]: unknown;
}

export type TerminologyGlossaryMergeCompatibility =
  | { compatible: true }
  | {
      compatible: false;
      reason: "source-language" | "target-language";
      expected: string;
      actual: string;
    };

export interface TerminologyGlossaryMergeConflict {
  incoming: GlossaryEntry;
  existing: readonly GlossaryEntry[];
}

export interface TerminologyGlossaryMergePlan {
  compatibility: TerminologyGlossaryMergeCompatibility;
  additions: readonly GlossaryEntry[];
  identical: readonly GlossaryEntry[];
  conflicts: readonly TerminologyGlossaryMergeConflict[];
}

function effectiveCaseSensitive(entry: GlossaryEntry): boolean {
  return entry.caseSensitive === true;
}

function effectiveWholeWord(entry: GlossaryEntry): boolean {
  return entry.wholeWord !== false;
}

function hasSameMatchingRules(left: GlossaryEntry, right: GlossaryEntry): boolean {
  return (
    left.source === right.source &&
    effectiveCaseSensitive(left) === effectiveCaseSensitive(right) &&
    effectiveWholeWord(left) === effectiveWholeWord(right)
  );
}

function hasSamePreferredTarget(left: GlossaryEntry, right: GlossaryEntry): boolean {
  return left.target === right.target;
}

export function planTerminologyGlossaryMerge(
  glossary: Readonly<MergeableGlossaryDocument>,
  incoming: Readonly<TerminologyGlossaryLanguageEntries>,
  sourceLanguage: string,
): TerminologyGlossaryMergePlan {
  if (glossary.sourceLanguage !== sourceLanguage) {
    return {
      compatibility: {
        compatible: false,
        reason: "source-language",
        expected: glossary.sourceLanguage,
        actual: sourceLanguage,
      },
      additions: [],
      identical: [],
      conflicts: [],
    };
  }

  if (glossary.targetLanguage !== incoming.targetLanguage) {
    return {
      compatibility: {
        compatible: false,
        reason: "target-language",
        expected: glossary.targetLanguage,
        actual: incoming.targetLanguage,
      },
      additions: [],
      identical: [],
      conflicts: [],
    };
  }

  const additions: GlossaryEntry[] = [];
  const identical: GlossaryEntry[] = [];
  const conflicts: TerminologyGlossaryMergeConflict[] = [];

  for (const entry of incoming.entries) {
    const matching = glossary.entries.filter((existing) => hasSameMatchingRules(existing, entry));
    if (matching.length === 0) {
      additions.push(entry);
      continue;
    }

    if (matching.some((existing) => hasSamePreferredTarget(existing, entry))) {
      identical.push(entry);
      continue;
    }

    conflicts.push({ incoming: entry, existing: matching });
  }

  return {
    compatibility: { compatible: true },
    additions,
    identical,
    conflicts,
  };
}

export function applyTerminologyGlossaryMerge<T extends MergeableGlossaryDocument>(
  glossary: Readonly<T>,
  plan: Readonly<TerminologyGlossaryMergePlan>,
): T {
  if (!plan.compatibility.compatible || plan.additions.length === 0) return { ...glossary };

  return {
    ...glossary,
    entries: [...glossary.entries, ...plan.additions],
  } as T;
}
