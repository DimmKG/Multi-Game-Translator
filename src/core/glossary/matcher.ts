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

function acceptedTargets(entry: GlossaryEntry) {
  return [entry.target, ...(entry.forms || []), ...(entry.alternatives || [])].filter(Boolean);
}

export function inspectGlossaryEntry(
  sourceText: string,
  targetText: string,
  entry: GlossaryEntry,
  glossary: GlossaryDocument = {},
): TerminologyIssue[] {
  if (!entry || entry.status === "deprecated" || !matchingSource(sourceText, entry)) return [];

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

export function inspectTerminology(
  sourceText: string,
  targetText: string,
  glossaries: GlossaryDocument[] = [],
): readonly TerminologyIssue[] {
  const issues: TerminologyIssue[] = [];
  for (const glossary of glossaries || []) {
    for (const entry of glossary.entries || []) {
      issues.push(...inspectGlossaryEntry(sourceText, targetText, entry, glossary));
    }
  }
  return Object.freeze(issues);
}
