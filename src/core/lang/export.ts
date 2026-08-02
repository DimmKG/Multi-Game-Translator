// SPDX-License-Identifier: AGPL-3.0-or-later
import { MISSING_TRANSLATION_PREFIX, SAME_TRANSLATION_PREFIX, type LangLine } from "./markers";
import { statusOf } from "./status";

/** Serialize workspace items back to a `.lang` document, preserving EOL. */
export function buildLangFile(items: LangLine[], eol: "\n" | "\r\n"): string {
  const lines: string[] = [];
  for (const item of items) {
    if (item.type !== "entry") {
      lines.push(item.raw);
      continue;
    }
    const status = statusOf(item);
    // Preserve an explicit SAME_TRANSLATION marker even without a loaded reference.
    if (item.markedSame) {
      lines.push(`${SAME_TRANSLATION_PREFIX}${item.key}=${item.value}`);
    } else if (status === "missing") {
      lines.push(`${MISSING_TRANSLATION_PREFIX}${item.key}=${item.value}`);
    } else {
      lines.push(`${item.key}=${item.value}`);
    }
  }
  return lines.join(eol);
}
