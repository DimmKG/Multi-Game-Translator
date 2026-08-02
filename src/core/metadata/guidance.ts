// SPDX-License-Identifier: AGPL-3.0-or-later
export interface MetadataGuidanceRule {
  key: string;
  messageKey: string;
  section?: string;
}

const GUIDANCE_RULES: readonly MetadataGuidanceRule[] = Object.freeze([
  Object.freeze({ key: "localname", messageKey: "metadata.localname" }),
  Object.freeze({ key: "engname", messageKey: "metadata.engname" }),
  Object.freeze({ key: "extrasymbols", messageKey: "metadata.extrasymbols" }),
  Object.freeze({
    section: "lang",
    key: "credits",
    messageKey: "metadata.langCredits",
  }),
]);

function normalizePart(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/^\[|\]$/g, "")
    .toLowerCase();
}

export function metadataGuidanceFor(entry: { key?: string; section?: string }) {
  const key = normalizePart(entry?.key);
  const section = normalizePart(entry?.section);
  return (
    GUIDANCE_RULES.find((rule) => {
      if (normalizePart(rule.key) !== key) return false;
      return rule.section == null || normalizePart(rule.section) === section;
    }) || null
  );
}

export function metadataGuidanceRules() {
  return GUIDANCE_RULES;
}
