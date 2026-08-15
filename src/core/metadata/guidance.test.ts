// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { metadataGuidanceFor, metadataGuidanceRules } from "./guidance";

describe("metadata guidance", () => {
  it("known language metadata keys expose localized guidance ids", () => {
    expect(metadataGuidanceFor({ key: "localname", namespace: "lang" })?.messageKey).toBe(
      "metadata.localname",
    );
    expect(metadataGuidanceFor({ key: "engname", namespace: "lang" })?.messageKey).toBe(
      "metadata.engname",
    );
    expect(metadataGuidanceFor({ key: "extrasymbols", namespace: "lang" })?.messageKey).toBe(
      "metadata.extrasymbols",
    );
  });

  it("credits guidance is restricted to the lang section", () => {
    expect(metadataGuidanceFor({ key: "credits", namespace: "lang" })?.messageKey).toBe(
      "metadata.langCredits",
    );
    expect(metadataGuidanceFor({ key: "credits", namespace: "general" })).toBeNull();
    expect(metadataGuidanceFor({ key: "credits" })).toBeNull();
  });

  it("matching normalizes section brackets and casing", () => {
    expect(metadataGuidanceFor({ key: "CREDITS", namespace: "[LANG]" })?.messageKey).toBe(
      "metadata.langCredits",
    );
  });

  it("guidance is data-driven and extensible", () => {
    const rules = metadataGuidanceRules();
    expect(rules).toHaveLength(4);
    expect(
      rules.every((rule) => typeof rule.key === "string" && typeof rule.messageKey === "string"),
    ).toBe(true);
  });
});
