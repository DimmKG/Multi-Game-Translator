// SPDX-License-Identifier: AGPL-3.0-or-later
import { PROTECTED_TOKEN_PATTERN } from "@/core/lang/markers";

export interface GlossaryEntry {
  source: string;
  target: string;
  forms?: readonly string[];
  alternatives?: readonly string[];
  forbidden?: readonly string[];
  caseSensitive?: boolean;
  wholeWord?: boolean;
  status?: string;
  category?: string;
  context?: string;
  note?: string;
  includeRegex?: string;
  excludeRegex?: string;
}

export interface GlossaryDocument {
  id?: string;
  name?: string;
  entries?: readonly GlossaryEntry[];
}

export interface TerminologyIssue {
  type: "forbidden" | "missing-preferred";
  source: string;
  preferred: string;
  found?: string;
  forms?: readonly string[];
  alternatives?: readonly string[];
  glossaryId: string;
  glossaryName: string;
  category: string;
  context: string;
  note: string;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termPattern(term: string, wholeWord: boolean) {
  const escaped = escapeRegExp(term);
  if (!wholeWord) return escaped;
  return `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`;
}

export function stripProtectedTokens(text: string): string {
  if (typeof text !== "string") return "";
  return text.replace(PROTECTED_TOKEN_PATTERN, " ");
}

export function containsGlossaryTerm(
  text: string,
  term: string,
  options: {
    caseSensitive?: boolean;
    wholeWord?: boolean;
    ignoreProtectedTokens?: boolean;
  } = {},
): boolean {
  if (typeof text !== "string" || typeof term !== "string" || term.length === 0) return false;
  const searchable = options.ignoreProtectedTokens === false ? text : stripProtectedTokens(text);
  const flags = options.caseSensitive ? "u" : "iu";
  return new RegExp(termPattern(term, options.wholeWord !== false), flags).test(searchable);
}

function matchingSource(sourceText: string, entry: GlossaryEntry) {
  return containsGlossaryTerm(sourceText, entry.source, entry);
}

function testRegexSafely(pattern: string, value: string): boolean {
  try {
    return new RegExp(pattern, "u").test(value);
  } catch {
    return false;
  }
}

/**
 * Restricts a rule to (or away from) specific `.lang` entries by translation
 * key, for source words that mean different things in different keys (e.g.
 * "Hat" the headwear item vs. "soundhat" the hi-hat drum sound). Invalid
 * regex is treated as "no match" rather than thrown — authoring validation
 * is where a bad pattern should be reported.
 */
function entryAppliesToKey(entry: GlossaryEntry, key: string): boolean {
  const value = key ?? "";
  if (entry.includeRegex && !testRegexSafely(entry.includeRegex, value)) return false;
  if (entry.excludeRegex && testRegexSafely(entry.excludeRegex, value)) return false;
  return true;
}

function acceptedTargets(entry: GlossaryEntry) {
  return [entry.target, ...(entry.forms || []), ...(entry.alternatives || [])].filter(Boolean);
}

export function inspectGlossaryEntry(
  sourceText: string,
  targetText: string,
  entry: GlossaryEntry,
  glossary: GlossaryDocument = {},
  key = "",
): TerminologyIssue[] {
  if (!entry || entry.status === "deprecated") return [];
  if (!entryAppliesToKey(entry, key)) return [];
  if (!matchingSource(sourceText, entry)) return [];

  const issues: TerminologyIssue[] = [];
  for (const forbidden of entry.forbidden || []) {
    if (containsGlossaryTerm(targetText, forbidden, entry)) {
      issues.push({
        type: "forbidden",
        source: entry.source,
        preferred: entry.target,
        found: forbidden,
        glossaryId: glossary.id || "",
        glossaryName: glossary.name || "",
        category: entry.category || "",
        context: entry.context || "",
        note: entry.note || "",
      });
    }
  }

  const accepted = acceptedTargets(entry);
  if (accepted.length && !accepted.some((term) => containsGlossaryTerm(targetText, term, entry))) {
    issues.push({
      type: "missing-preferred",
      source: entry.source,
      preferred: entry.target,
      forms: Object.freeze([...(entry.forms || [])]),
      alternatives: Object.freeze([...(entry.alternatives || [])]),
      glossaryId: glossary.id || "",
      glossaryName: glossary.name || "",
      category: entry.category || "",
      context: entry.context || "",
      note: entry.note || "",
    });
  }

  return issues;
}

/**
 * True when `longer` is a strictly longer phrase that contains `shorter`'s
 * source as a whole word and also matches the same source text. A generic
 * entry (e.g. "Log") is then redundant with a more specific one that already
 * covers this text (e.g. "Log Bench"): only the specific entry should apply.
 */
function isSubsumedByLongerEntry(
  sourceText: string,
  entry: GlossaryEntry,
  candidates: readonly GlossaryEntry[],
  key: string,
): boolean {
  return candidates.some((candidate) => {
    if (candidate === entry || candidate.status === "deprecated") return false;
    if (!entryAppliesToKey(candidate, key)) return false;
    if (candidate.source.length <= entry.source.length) return false;
    if (!containsGlossaryTerm(candidate.source, entry.source, { wholeWord: true })) return false;
    return matchingSource(sourceText, candidate);
  });
}

export function inspectTerminology(
  sourceText: string,
  targetText: string,
  glossaries: GlossaryDocument[] = [],
  key = "",
): readonly TerminologyIssue[] {
  const entries = (glossaries || []).flatMap((glossary) =>
    (glossary.entries || []).map((entry) => ({ entry, glossary })),
  );
  const allSources = entries.map((pair) => pair.entry);

  const issues: TerminologyIssue[] = [];
  for (const { entry, glossary } of entries) {
    if (isSubsumedByLongerEntry(sourceText, entry, allSources, key)) continue;
    issues.push(...inspectGlossaryEntry(sourceText, targetText, entry, glossary, key));
  }
  return Object.freeze(issues);
}
