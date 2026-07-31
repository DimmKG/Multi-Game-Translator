"use strict";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termPattern(term, wholeWord) {
  const escaped = escapeRegExp(term);
  if (!wholeWord) return escaped;
  return `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`;
}

export function containsGlossaryTerm(text, term, options = {}) {
  if (typeof text !== "string" || typeof term !== "string" || term.length === 0) return false;
  const flags = options.caseSensitive ? "u" : "iu";
  return new RegExp(termPattern(term, options.wholeWord !== false), flags).test(text);
}

function matchingSource(sourceText, entry) {
  return containsGlossaryTerm(sourceText, entry.source, entry);
}

function acceptedTargets(entry) {
  return [entry.target, ...(entry.forms || []), ...(entry.alternatives || [])].filter(Boolean);
}

export function inspectGlossaryEntry(sourceText, targetText, entry, glossary = {}) {
  if (!entry || entry.status === "deprecated" || !matchingSource(sourceText, entry)) return [];

  const issues = [];
  for (const forbidden of entry.forbidden || []) {
    if (containsGlossaryTerm(targetText, forbidden, entry)) {
      issues.push(Object.freeze({
        type: "forbidden",
        source: entry.source,
        preferred: entry.target,
        found: forbidden,
        glossaryId: glossary.id || "",
        glossaryName: glossary.name || "",
        category: entry.category || "",
        context: entry.context || "",
        note: entry.note || ""
      }));
    }
  }

  const accepted = acceptedTargets(entry);
  if (accepted.length && !accepted.some(term => containsGlossaryTerm(targetText, term, entry))) {
    issues.push(Object.freeze({
      type: "missing-preferred",
      source: entry.source,
      preferred: entry.target,
      forms: Object.freeze([...(entry.forms || [])]),
      alternatives: Object.freeze([...(entry.alternatives || [])]),
      glossaryId: glossary.id || "",
      glossaryName: glossary.name || "",
      category: entry.category || "",
      context: entry.context || "",
      note: entry.note || ""
    }));
  }

  return issues;
}

export function inspectTerminology(sourceText, targetText, glossaries = []) {
  const issues = [];
  for (const glossary of glossaries || []) {
    for (const entry of glossary.entries || []) {
      issues.push(...inspectGlossaryEntry(sourceText, targetText, entry, glossary));
    }
  }
  return Object.freeze(issues);
}
