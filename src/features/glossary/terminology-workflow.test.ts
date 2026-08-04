// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const workspaceSource = await readFile(
  new URL("./TerminologyWorkspace.tsx", import.meta.url),
  "utf8",
);
const reviewSource = await readFile(
  new URL("./TerminologyReviewWorkspace.tsx", import.meta.url),
  "utf8",
);
const mergeSource = await readFile(
  new URL("./TerminologyGlossaryMergeWorkspace.tsx", import.meta.url),
  "utf8",
);

describe("terminology workflow component wiring", () => {
  it("keeps review state in the parent so export and merge receive live decisions", () => {
    expect(workspaceSource).toContain("const [reviewState, setReviewState]");
    expect(workspaceSource).toContain("buildTerminologyReviewExport(");
    expect(workspaceSource).toContain("reviewState={reviewState}");
    expect(workspaceSource).toContain("onReviewStateChange=");
    expect(reviewSource).not.toContain("useState<TerminologyReviewState>");
    expect(reviewSource).not.toContain("loadTerminologyReviewState");
  });

  it("blocks extraction on corpus validation problems and uses explicit workflow labels", () => {
    expect(workspaceSource).toContain("validateTerminologyInputs(");
    expect(workspaceSource).toContain("inputProblems.length === 0");
    expect(workspaceSource).toContain('t("terminology.extractCandidates")');
    expect(workspaceSource).toContain('t("terminology.minimumFrequency")');
  });

  it("auto-selects compatible glossaries and applies additions plus classified updates", () => {
    expect(mergeSource).toContain("chooseTerminologyMergeTarget(");
    expect(mergeSource).toContain("compatibleTerminologyGlossaries(");
    expect(mergeSource).toContain('t("terminology.applyGlossaryChanges")');
    expect(mergeSource).toContain("plan.updates.length");
    expect(mergeSource).toContain('t("terminology.mergeNeedsAccepted")');
  });

  it("requires explicit candidate and variant classification in the review UI", () => {
    expect(reviewSource).toContain("canAcceptTerminologyCandidate(");
    expect(reviewSource).toContain("updateTerminologyCandidateKind(");
    expect(reviewSource).toContain("updateTerminologyReviewedSource(");
    expect(reviewSource).toContain("updateTerminologyVariantClassification(");
    expect(reviewSource).toContain('t("terminology.sentenceLikeWarning")');
  });
});
