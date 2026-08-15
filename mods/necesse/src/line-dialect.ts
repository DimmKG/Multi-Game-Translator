// SPDX-License-Identifier: AGPL-3.0-or-later
import { MISSING_TRANSLATION_PREFIX, SAME_TRANSLATION_PREFIX } from "./markers";
import { NECESSE_PLACEHOLDER_PATTERN } from "./placeholders";

/**
 * Feeds the host's generic line-diff tool (src/core/compare/token-aware-diff.ts)
 * the bits specific to Necesse's `.lang` format. Structurally typed against that
 * module's LineDialect — kept untyped here so this mod has no dependency on host code.
 */
export const necesseLineDialect = {
  missingPrefix: MISSING_TRANSLATION_PREFIX,
  samePrefix: SAME_TRANSLATION_PREFIX,
  protectedTokenPattern: NECESSE_PLACEHOLDER_PATTERN,
};
