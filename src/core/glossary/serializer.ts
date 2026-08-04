// SPDX-License-Identifier: AGPL-3.0-or-later

import { isIsoDate } from "./contract";
import type { GlossaryDraft, GlossaryDraftEntry } from "./draft";
import { validateGlossaryDocument, type GlossaryValidationProblem } from "./validation";

export class GlossaryDraftValidationError extends Error {
  readonly problems: readonly GlossaryValidationProblem[];

  constructor(problems: readonly GlossaryValidationProblem[]) {
    super("Glossary draft has blocking validation errors.");
    this.name = "GlossaryDraftValidationError";
    this.problems = problems;
  }
}

function canonicalEntry(entry: Readonly<GlossaryDraftEntry>) {
  return {
    source: entry.source,
    target: entry.target,
    ...(entry.forms.length > 0 ? { forms: [...entry.forms] } : {}),
    ...(entry.alternatives.length > 0 ? { alternatives: [...entry.alternatives] } : {}),
    ...(entry.forbidden.length > 0 ? { forbidden: [...entry.forbidden] } : {}),
    caseSensitive: entry.caseSensitive,
    wholeWord: entry.wholeWord,
    status: entry.status,
    ...(entry.category ? { category: entry.category } : {}),
    ...(entry.context ? { context: entry.context } : {}),
    ...(entry.note ? { note: entry.note } : {}),
  };
}

export function buildGlossaryExportDocument(draft: Readonly<GlossaryDraft>, updatedAt: string) {
  const validation = validateGlossaryDocument(draft);
  const errors = [...validation.errors];
  if (!isIsoDate(updatedAt)) {
    errors.push({ severity: "error", code: "updated-at-invalid", path: "updatedAt" });
  }
  if (errors.length > 0) throw new GlossaryDraftValidationError(errors);

  return {
    format: draft.format,
    version: draft.version,
    id: draft.id,
    name: draft.name,
    sourceLanguage: draft.sourceLanguage,
    targetLanguage: draft.targetLanguage,
    ...(draft.game ? { game: draft.game } : {}),
    ...(draft.authors.length > 0 ? { authors: [...draft.authors] } : {}),
    updatedAt,
    entries: draft.entries.map(canonicalEntry),
  };
}

export function serializeGlossaryDraft(draft: Readonly<GlossaryDraft>, updatedAt: string): string {
  return `${JSON.stringify(buildGlossaryExportDocument(draft, updatedAt), null, 2)}\n`;
}
