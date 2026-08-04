// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  TerminologyCandidate,
  TerminologyCorpusFile,
  TerminologyEvidence,
} from "./extract-candidates";
import type { TerminologyReviewDecision, TerminologyReviewState } from "./review-persistence";

export const TERMINOLOGY_REVIEW_EXPORT_VERSION = 1 as const;

export interface TerminologyReviewedLanguage {
  languageCode: string;
  filename: string;
  preferredValue: string | null;
  observedVariants: string[];
}

export interface TerminologyReviewedCandidate {
  source: string;
  decision: Exclude<TerminologyReviewDecision, "pending">;
  sourceFrequency: number;
  sourceKeys: string[];
  sections: string[];
  languages: TerminologyReviewedLanguage[];
  evidence: TerminologyEvidence[];
}

export interface TerminologyReviewExport {
  format: "necesse-terminology-review";
  version: typeof TERMINOLOGY_REVIEW_EXPORT_VERSION;
  sourceLanguageCode: string;
  sourceFilename: string;
  generatedAt: string;
  candidates: TerminologyReviewedCandidate[];
}

function isExplicitDecision(
  decision: TerminologyReviewDecision | undefined,
): decision is Exclude<TerminologyReviewDecision, "pending"> {
  return decision === "accepted" || decision === "rejected" || decision === "needs-review";
}

function buildReviewedCandidate(
  candidate: TerminologyCandidate,
  reviewState: Readonly<TerminologyReviewState>,
): TerminologyReviewedCandidate | null {
  const decision = reviewState.decisions[candidate.source];
  if (!isExplicitDecision(decision)) return null;

  const preferredByLanguage = reviewState.preferredVariants[candidate.source] ?? {};
  const languages = candidate.languages.map((language) => {
    const preferredValue = preferredByLanguage[language.languageCode]?.trim() || null;
    return {
      languageCode: language.languageCode,
      filename: language.filename,
      preferredValue,
      observedVariants: language.variants.map((variant) => variant.value),
    };
  });

  if (decision === "accepted" && languages.some((language) => !language.preferredValue)) {
    return null;
  }

  return {
    source: candidate.source,
    decision,
    sourceFrequency: candidate.sourceFrequency,
    sourceKeys: candidate.sourceKeys,
    sections: candidate.sections,
    languages,
    evidence: candidate.evidence,
  };
}

export function buildTerminologyReviewExport(
  sourceFile: TerminologyCorpusFile,
  candidates: readonly TerminologyCandidate[],
  reviewState: Readonly<TerminologyReviewState>,
  generatedAt = new Date().toISOString(),
): TerminologyReviewExport {
  return {
    format: "necesse-terminology-review",
    version: TERMINOLOGY_REVIEW_EXPORT_VERSION,
    sourceLanguageCode: sourceFile.languageCode,
    sourceFilename: sourceFile.filename,
    generatedAt,
    candidates: candidates.flatMap((candidate) => {
      const reviewed = buildReviewedCandidate(candidate, reviewState);
      return reviewed ? [reviewed] : [];
    }),
  };
}
