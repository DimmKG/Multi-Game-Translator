// SPDX-License-Identifier: AGPL-3.0-or-later

import type { GlossaryEntry } from "../glossary/matcher";
import type { TerminologyReviewExport } from "./review-export";

export const TERMINOLOGY_GLOSSARY_ENTRY_EXPORT_VERSION = 1 as const;

export interface TerminologyGlossaryLanguageEntries {
  targetLanguage: string;
  entries: GlossaryEntry[];
}

export interface TerminologyGlossaryEntryExport {
  format: "necesse-glossary-entries";
  version: typeof TERMINOLOGY_GLOSSARY_ENTRY_EXPORT_VERSION;
  sourceLanguage: string;
  generatedAt: string;
  languages: TerminologyGlossaryLanguageEntries[];
}

export function buildTerminologyGlossaryEntryExport(
  review: Readonly<TerminologyReviewExport>,
  generatedAt = new Date().toISOString(),
): TerminologyGlossaryEntryExport {
  const byLanguage = new Map<string, GlossaryEntry[]>();

  for (const candidate of review.candidates) {
    if (candidate.decision !== "accepted") continue;

    for (const language of candidate.languages) {
      const target = language.preferredValue?.trim();
      if (!target) continue;

      const entries = byLanguage.get(language.languageCode) ?? [];
      const { forms, alternatives, forbidden } = language.classifiedValues;
      entries.push({
        source: candidate.entrySource,
        target,
        ...(forms.length > 0 ? { forms } : {}),
        ...(alternatives.length > 0 ? { alternatives } : {}),
        ...(forbidden.length > 0 ? { forbidden } : {}),
      });
      byLanguage.set(language.languageCode, entries);
    }
  }

  return {
    format: "necesse-glossary-entries",
    version: TERMINOLOGY_GLOSSARY_ENTRY_EXPORT_VERSION,
    sourceLanguage: review.sourceLanguageCode,
    generatedAt,
    languages: [...byLanguage.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([targetLanguage, entries]) => ({
        targetLanguage,
        entries: entries.sort((left, right) => left.source.localeCompare(right.source)),
      })),
  };
}
