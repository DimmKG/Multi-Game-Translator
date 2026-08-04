// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TerminologyReviewDecision, TerminologyReviewState } from "./review-persistence";

export function emptyTerminologyReviewState(): TerminologyReviewState {
  return { decisions: {}, preferredVariants: {} };
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
  return { decisions, preferredVariants: state.preferredVariants };
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
  if (!value.trim() && decisions[source] === "accepted") {
    decisions[source] = "needs-review";
  }

  return { decisions, preferredVariants };
}
