// SPDX-License-Identifier: AGPL-3.0-or-later
import type {
  TerminologyCandidateKind,
  TerminologyReviewDecision,
  TerminologyReviewState,
  TerminologyVariantClassification,
} from "./review-persistence";

export function emptyTerminologyReviewState(): TerminologyReviewState {
  return {
    decisions: {},
    candidateKinds: {},
    reviewedSources: {},
    preferredVariants: {},
    variantClassifications: {},
  };
}

export function effectiveTerminologyReviewedSource(
  state: Readonly<TerminologyReviewState>,
  source: string,
): string {
  return Object.hasOwn(state.reviewedSources, source)
    ? state.reviewedSources[source].trim()
    : source.trim();
}

export function canAcceptTerminologyCandidate(
  state: Readonly<TerminologyReviewState>,
  source: string,
  languageCodes: readonly string[],
): boolean {
  const kind = state.candidateKinds[source];
  if (
    (kind !== "term" && kind !== "phrase") ||
    !effectiveTerminologyReviewedSource(state, source)
  ) {
    return false;
  }

  const preferred = state.preferredVariants[source] ?? {};
  const classified = state.variantClassifications[source] ?? {};
  return languageCodes.every((languageCode) => {
    const value = preferred[languageCode]?.trim();
    if (!value) return false;
    return classified[languageCode]?.[value] !== "forbidden";
  });
}

function downgradeAccepted(state: TerminologyReviewState, source: string): TerminologyReviewState {
  if (state.decisions[source] !== "accepted") return state;
  return {
    ...state,
    decisions: { ...state.decisions, [source]: "needs-review" },
  };
}

export function updateTerminologyReviewDecision(
  state: Readonly<TerminologyReviewState>,
  source: string,
  decision: TerminologyReviewDecision,
  canAccept: boolean,
): TerminologyReviewState {
  if (decision === "accepted" && !canAccept) return state;

  const decisions = { ...state.decisions };
  if (decision === "pending") delete decisions[source];
  else decisions[source] = decision;
  return { ...state, decisions };
}

export function updateTerminologyCandidateKind(
  state: Readonly<TerminologyReviewState>,
  source: string,
  kind: TerminologyCandidateKind | null,
): TerminologyReviewState {
  const candidateKinds = { ...state.candidateKinds };
  if (kind) candidateKinds[source] = kind;
  else delete candidateKinds[source];
  const next = { ...state, candidateKinds };
  return kind === "term" || kind === "phrase" ? next : downgradeAccepted(next, source);
}

export function updateTerminologyReviewedSource(
  state: Readonly<TerminologyReviewState>,
  source: string,
  value: string,
): TerminologyReviewState {
  const reviewedSources = { ...state.reviewedSources };
  if (value === source) delete reviewedSources[source];
  else reviewedSources[source] = value;
  return downgradeAccepted({ ...state, reviewedSources }, source);
}

export function updateTerminologyPreferredVariant(
  state: Readonly<TerminologyReviewState>,
  source: string,
  languageCode: string,
  value: string,
): TerminologyReviewState {
  const nextForSource = { ...(state.preferredVariants[source] ?? {}) };
  if (value.trim()) nextForSource[languageCode] = value;
  else delete nextForSource[languageCode];

  const preferredVariants = { ...state.preferredVariants };
  if (Object.keys(nextForSource).length > 0) preferredVariants[source] = nextForSource;
  else delete preferredVariants[source];

  const decisions = { ...state.decisions };
  const preferredIsForbidden =
    state.variantClassifications[source]?.[languageCode]?.[value.trim()] === "forbidden";
  if ((!value.trim() || preferredIsForbidden) && decisions[source] === "accepted") {
    decisions[source] = "needs-review";
  }

  return { ...state, decisions, preferredVariants };
}

export function updateTerminologyVariantClassification(
  state: Readonly<TerminologyReviewState>,
  source: string,
  languageCode: string,
  value: string,
  classification: TerminologyVariantClassification | null,
): TerminologyReviewState {
  const normalizedValue = value.trim();
  if (!normalizedValue) return state;

  const sourceClassifications = { ...(state.variantClassifications[source] ?? {}) };
  const languageClassifications = { ...(sourceClassifications[languageCode] ?? {}) };
  if (classification) languageClassifications[normalizedValue] = classification;
  else delete languageClassifications[normalizedValue];

  if (Object.keys(languageClassifications).length > 0) {
    sourceClassifications[languageCode] = languageClassifications;
  } else {
    delete sourceClassifications[languageCode];
  }

  const variantClassifications = { ...state.variantClassifications };
  if (Object.keys(sourceClassifications).length > 0) {
    variantClassifications[source] = sourceClassifications;
  } else {
    delete variantClassifications[source];
  }

  const next = { ...state, variantClassifications };
  const preferred = state.preferredVariants[source]?.[languageCode]?.trim();
  return classification === "forbidden" && preferred === normalizedValue
    ? downgradeAccepted(next, source)
    : next;
}
