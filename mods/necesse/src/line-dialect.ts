// SPDX-License-Identifier: AGPL-3.0-or-later
import { MISSING_TRANSLATION_PREFIX, SAME_TRANSLATION_PREFIX } from "./markers";

/**
 * Feeds the host's generic line-diff tool (src/core/compare/token-aware-diff.ts)
 * the bits specific to Necesse's `.lang` status-marker convention. Structurally
 * typed against that module's DiffOptions — kept untyped here so this mod has
 * no dependency on host code.
 */
function splitPrefix(raw: string): {
  status: "missing" | "same" | null;
  prefix: string;
  body: string;
} {
  if (raw.startsWith(MISSING_TRANSLATION_PREFIX)) {
    return {
      status: "missing",
      prefix: MISSING_TRANSLATION_PREFIX,
      body: raw.slice(MISSING_TRANSLATION_PREFIX.length),
    };
  }
  if (raw.startsWith(SAME_TRANSLATION_PREFIX)) {
    return {
      status: "same",
      prefix: SAME_TRANSLATION_PREFIX,
      body: raw.slice(SAME_TRANSLATION_PREFIX.length),
    };
  }
  return { status: null, prefix: "", body: raw };
}

/** Normalizes a `.lang` line for diff alignment by stripping its status marker, so a status-only edit still aligns as one changed row instead of a delete+add. */
export function necesseIdentity(line: string): string {
  return splitPrefix(String(line ?? "")).body;
}

/** Classifies a `.lang` line as a status-prefixed key=value entry, or null for blank/comment/section lines. */
export function necesseParseEntryLine(
  line: string,
): { status: string | null; prefix: string; key: string; value: string } | null {
  const raw = String(line ?? "");
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("//") || /^\[.*\]$/.test(trimmed)) return null;

  const { status, prefix, body } = splitPrefix(raw);
  const separator = body.indexOf("=");
  if (separator < 0) return null;
  return { status, prefix, key: body.slice(0, separator), value: body.slice(separator + 1) };
}

export const necesseLineDialect = {
  identity: necesseIdentity,
  parseEntryLine: necesseParseEntryLine,
};
