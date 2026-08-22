// SPDX-License-Identifier: AGPL-3.0-or-later
import { createRegexTokenizer, type PlaceholderClassification } from "@mgt/sdk";

/**
 * C-style printf conversions (%s %d %1$s ...) — the one placeholder
 * convention essentially every gettext-consuming toolchain understands
 * (C/C++, Python %-formatting, PHP, ...), unlike project-specific {}/ICU
 * styles that get layered on top of gettext elsewhere. "%%" (a literal
 * percent, not a substitution) is deliberately excluded.
 */
export const GETTEXT_PLACEHOLDER_PATTERN = /%(\d+\$)?[bcdeEfFgGosuxX]/g;

function classify(match: string): PlaceholderClassification {
  const conversion = match.slice(-1);
  return { kind: `printf-${conversion}`, severity: "required" };
}

export const gettextPlaceholderTokenizer = createRegexTokenizer(
  GETTEXT_PLACEHOLDER_PATTERN,
  classify,
);
