// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import {
  emptyTerminologyReviewState,
  updateTerminologyPreferredVariant,
  updateTerminologyReviewDecision,
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
      preferredVariants: {},
    });
  });

  it("removes pending decisions without discarding preferred values", () => {
    const state = {
      decisions: { "Iron Bar": "needs-review" as const },
      preferredVariants: { "Iron Bar": { bg: "Желязно кюлче" } },
    };

    expect(updateTerminologyReviewDecision(state, "Iron Bar", "pending", true)).toEqual({
      decisions: {},
      preferredVariants: state.preferredVariants,
    });
  });
});
