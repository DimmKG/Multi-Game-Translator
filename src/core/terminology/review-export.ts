// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  TerminologyCandidate,
  TerminologyCorpusFile,
  TerminologyEvidence,
} from "./extract-candidates";
import type {
  TerminologyCandidateKind,
  TerminologyReviewDecision,
  TerminologyReviewState,
} from "./review-persistence";
import { canAcceptTerminologyCandidate, effectiveTerminologyReviewedSource } from "./review-state";

export const TERMINOLOGY_REVIEW_EXPORT_VERSION = 2 as const;

export interface TerminologyReviewedClassifiedValues {
  forms: string[];
  alternatives: string[];
  forbidden: string[];
}

export interface TerminologyReviewedLanguage {
  languageCode: string;
  filename: string;
  preferredValue: string | null;
  observedVariants: string[];
  classifiedValues: TerminologyReviewedClassifiedValues;
}

export interface TerminologyReviewedCandidate {
  source: string;
  entrySource: string;
  candidateKind: TerminologyCandidateKind | null;
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
  const classifiedByLanguage = reviewState.variantClassifications[candidate.source] ?? {};
  const languages = candidate.languages.map((language) => {
    const preferredValue = preferredByLanguage[language.languageCode]?.trim() || null;
    const classified = classifiedByLanguage[language.languageCode] ?? {};
    const classifiedValues: TerminologyReviewedClassifiedValues = {
      forms: [],
      alternatives: [],
      forbidden: [],
    };
    for (const [value, classification] of Object.entries(classified)) {
      if (classification === "form") classifiedValues.forms.push(value);
      else if (classification === "alternative") classifiedValues.alternatives.push(value);
      else classifiedValues.forbidden.push(value);
    }
    classifiedValues.forms.sort((left, right) => left.localeCompare(right));
    classifiedValues.alternatives.sort((left, right) => left.localeCompare(right));
    classifiedValues.forbidden.sort((left, right) => left.localeCompare(right));
    return {
      languageCode: language.languageCode,
      filename: language.filename,
      preferredValue,
      observedVariants: language.variants.map((variant) => variant.value),
      classifiedValues,
    };
  });

  if (
    decision === "accepted" &&
    !canAcceptTerminologyCandidate(
      reviewState,
      candidate.source,
      candidate.languages.map((language) => language.languageCode),
    )
  ) {
    return null;
  }

  return {
    source: candidate.source,
    entrySource: effectiveTerminologyReviewedSource(reviewState, candidate.source),
    candidateKind: reviewState.candidateKinds[candidate.source] ?? null,
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
