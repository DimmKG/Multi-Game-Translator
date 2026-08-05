// SPDX-License-Identifier: AGPL-3.0-or-later

import type { GlossaryEntry } from "../glossary/matcher";
import type { TerminologyGlossaryLanguageEntries } from "./glossary-entry-export";

export interface MergeableGlossaryDocument {
  format?: string;
  version?: number;
  id?: string;
  name?: string;
  sourceLanguage: string;
  targetLanguage: string;
  game?: string;
  authors?: readonly string[];
  updatedAt?: string;
  enabled?: boolean;
  entries: readonly GlossaryEntry[];
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

export interface TerminologyGlossaryMergeUpdate {
  incoming: GlossaryEntry;
  existing: GlossaryEntry;
  merged: GlossaryEntry;
}

export interface TerminologyGlossaryMergePlan {
  compatibility: TerminologyGlossaryMergeCompatibility;
  additions: readonly GlossaryEntry[];
  updates: readonly TerminologyGlossaryMergeUpdate[];
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

const CLASSIFIED_FIELDS = ["forms", "alternatives", "forbidden"] as const;

function mergeValues(
  existing: readonly string[] | undefined,
  incoming: readonly string[] | undefined,
): readonly string[] | undefined {
  const merged = [...(existing ?? [])];
  const seen = new Set(merged);
  for (const value of incoming ?? []) {
    if (!seen.has(value)) {
      seen.add(value);
      merged.push(value);
    }
  }
  return merged.length > 0 ? merged : undefined;
}

function mergeAdditiveValues(existing: GlossaryEntry, incoming: GlossaryEntry): GlossaryEntry {
  const merged: GlossaryEntry = { ...existing };
  for (const field of CLASSIFIED_FIELDS) {
    const values = mergeValues(existing[field], incoming[field]);
    if (values) merged[field] = values;
  }
  return merged;
}

function hasSameClassifiedValues(left: GlossaryEntry, right: GlossaryEntry): boolean {
  return CLASSIFIED_FIELDS.every((field) => {
    const leftValues = left[field] ?? [];
    const rightValues = right[field] ?? [];
    return (
      leftValues.length === rightValues.length &&
      leftValues.every((value, index) => value === rightValues[index])
    );
  });
}

function hasClassificationConflict(existing: GlossaryEntry, incoming: GlossaryEntry): boolean {
  return CLASSIFIED_FIELDS.some((incomingField) =>
    (incoming[incomingField] ?? []).some((value) =>
      CLASSIFIED_FIELDS.some(
        (existingField) =>
          existingField !== incomingField && (existing[existingField] ?? []).includes(value),
      ),
    ),
  );
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
      updates: [],
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
      updates: [],
      identical: [],
      conflicts: [],
    };
  }

  const additions: GlossaryEntry[] = [];
  const updates: TerminologyGlossaryMergeUpdate[] = [];
  const identical: GlossaryEntry[] = [];
  const conflicts: TerminologyGlossaryMergeConflict[] = [];

  for (const entry of incoming.entries) {
    const matching = glossary.entries.filter((existing) => hasSameMatchingRules(existing, entry));
    if (matching.length === 0) {
      additions.push(entry);
      continue;
    }

    const samePreferred = matching.find((existing) => hasSamePreferredTarget(existing, entry));
    if (samePreferred) {
      if (hasClassificationConflict(samePreferred, entry)) {
        conflicts.push({ incoming: entry, existing: matching });
        continue;
      }
      const merged = mergeAdditiveValues(samePreferred, entry);
      if (hasSameClassifiedValues(samePreferred, merged)) identical.push(entry);
      else updates.push({ incoming: entry, existing: samePreferred, merged });
      continue;
    }

    conflicts.push({ incoming: entry, existing: matching });
  }

  return {
    compatibility: { compatible: true },
    additions,
    updates,
    identical,
    conflicts,
  };
}

export function applyTerminologyGlossaryMerge<T extends MergeableGlossaryDocument>(
  glossary: Readonly<T>,
  plan: Readonly<TerminologyGlossaryMergePlan>,
): T {
  if (
    !plan.compatibility.compatible ||
    (plan.additions.length === 0 && plan.updates.length === 0)
  ) {
    return { ...glossary };
  }

  const updates = new Map(plan.updates.map((update) => [update.existing, update.merged]));

  return {
    ...glossary,
    entries: [...glossary.entries.map((entry) => updates.get(entry) ?? entry), ...plan.additions],
  } as T;
}
