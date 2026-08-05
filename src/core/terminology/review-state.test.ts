// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import {
  canAcceptTerminologyCandidate,
  emptyTerminologyReviewState,
  updateTerminologyCandidateKind,
  updateTerminologyPreferredVariant,
  updateTerminologyReviewedSource,
  updateTerminologyReviewDecision,
  updateTerminologyVariantClassification,
} from "./review-state";

describe("live terminology review state", () => {
  it("requires a preferred value before accepting a candidate", () => {
    const empty = emptyTerminologyReviewState();

    expect(updateTerminologyReviewDecision(empty, "Iron Bar", "accepted", false)).toBe(empty);
    expect(updateTerminologyReviewDecision(empty, "Iron Bar", "accepted", true).decisions).toEqual({
      "Iron Bar": "accepted",
    });
  });

  it("keeps one preferred value per language and downgrades incomplete accepted entries", () => {
    const preferred = updateTerminologyPreferredVariant(
      emptyTerminologyReviewState(),
      "Iron Bar",
      "bg",
      "Желязно кюлче",
    );
    const accepted = updateTerminologyReviewDecision(preferred, "Iron Bar", "accepted", true);
    const cleared = updateTerminologyPreferredVariant(accepted, "Iron Bar", "bg", "");

    expect(preferred.preferredVariants).toEqual({
      "Iron Bar": { bg: "Желязно кюлче" },
    });
    expect(cleared).toEqual({
      decisions: { "Iron Bar": "needs-review" },
      candidateKinds: {},
      reviewedSources: {},
      preferredVariants: {},
      variantClassifications: {},
    });
  });

  it("removes pending decisions without discarding preferred values", () => {
    const state = {
      ...emptyTerminologyReviewState(),
      decisions: { "Iron Bar": "needs-review" as const },
      preferredVariants: { "Iron Bar": { bg: "Желязно кюлче" } },
    };

    expect(updateTerminologyReviewDecision(state, "Iron Bar", "pending", true)).toEqual({
      ...state,
      decisions: {},
    });
  });

  it("requires an explicit term-like kind and reviewed source before acceptance", () => {
    const preferred = updateTerminologyPreferredVariant(
      emptyTerminologyReviewState(),
      "You feel very cold",
      "bg",
      "Много ти е студено",
    );
    const sentence = updateTerminologyCandidateKind(
      preferred,
      "You feel very cold",
      "sentence-like",
    );
    expect(canAcceptTerminologyCandidate(sentence, "You feel very cold", ["bg"])).toBe(false);

    const edited = updateTerminologyReviewedSource(
      updateTerminologyCandidateKind(sentence, "You feel very cold", "term"),
      "You feel very cold",
      "Cold",
    );
    expect(canAcceptTerminologyCandidate(edited, "You feel very cold", ["bg"])).toBe(true);
  });

  it("keeps variant classification explicit and blocks a forbidden preferred value", () => {
    let state = updateTerminologyCandidateKind(emptyTerminologyReviewState(), "Settler", "term");
    state = updateTerminologyPreferredVariant(state, "Settler", "bg", "Заселник");
    state = updateTerminologyVariantClassification(state, "Settler", "bg", "Заселници", "form");
    state = updateTerminologyVariantClassification(
      state,
      "Settler",
      "bg",
      "Колонист",
      "alternative",
    );

    expect(state.variantClassifications).toEqual({
      Settler: {
        bg: { Заселници: "form", Колонист: "alternative" },
      },
    });
    expect(canAcceptTerminologyCandidate(state, "Settler", ["bg"])).toBe(true);

    state = updateTerminologyVariantClassification(state, "Settler", "bg", "Заселник", "forbidden");
    expect(canAcceptTerminologyCandidate(state, "Settler", ["bg"])).toBe(false);
  });
});
