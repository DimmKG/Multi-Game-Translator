// SPDX-License-Identifier: AGPL-3.0-or-later

import { GLOSSARY_FORMAT, GLOSSARY_FORMAT_VERSION } from "./contract";
import type { NormalizedGlossary, NormalizedGlossaryEntry } from "./loader";

export interface GlossaryDraftEntry {
  source: string;
  target: string;
  forms: string[];
  alternatives: string[];
  forbidden: string[];
  caseSensitive: boolean;
  wholeWord: boolean;
  status: string;
  category: string;
  context: string;
  note: string;
}

export interface GlossaryDraft {
  format: typeof GLOSSARY_FORMAT;
  version: typeof GLOSSARY_FORMAT_VERSION;
  id: string;
  name: string;
  sourceLanguage: string;
  targetLanguage: string;
  game: string;
  authors: string[];
  updatedAt: string;
  entries: GlossaryDraftEntry[];
}

export type GlossaryDraftEntryInput = Partial<
  Omit<GlossaryDraftEntry, "forms" | "alternatives" | "forbidden">
> & {
  forms?: readonly string[];
  alternatives?: readonly string[];
  forbidden?: readonly string[];
};

export type GlossaryDraftInput = Partial<Omit<GlossaryDraft, "authors" | "entries">> & {
  authors?: readonly string[];
  entries?: readonly GlossaryDraftEntryInput[];
};

export function createGlossaryDraftEntry(input: GlossaryDraftEntryInput = {}): GlossaryDraftEntry {
  return {
    source: input.source ?? "",
    target: input.target ?? "",
    forms: [...(input.forms ?? [])],
    alternatives: [...(input.alternatives ?? [])],
    forbidden: [...(input.forbidden ?? [])],
    caseSensitive: input.caseSensitive ?? false,
    wholeWord: input.wholeWord ?? true,
    status: input.status ?? "draft",
    category: input.category ?? "",
    context: input.context ?? "",
    note: input.note ?? "",
  };
}

export function createGlossaryDraft(input: GlossaryDraftInput = {}): GlossaryDraft {
  return {
    format: GLOSSARY_FORMAT,
    version: GLOSSARY_FORMAT_VERSION,
    id: input.id ?? "",
    name: input.name ?? "",
    sourceLanguage: input.sourceLanguage ?? "en",
    targetLanguage: input.targetLanguage ?? "",
    game: input.game ?? "Necesse",
    authors: [...(input.authors ?? [])],
    updatedAt: input.updatedAt ?? "",
    entries: (input.entries ?? []).map(createGlossaryDraftEntry),
  };
}

function draftEntryFromNormalized(entry: NormalizedGlossaryEntry): GlossaryDraftEntry {
  return createGlossaryDraftEntry({
    ...entry,
    forms: entry.forms,
    alternatives: entry.alternatives,
    forbidden: entry.forbidden,
  });
}

export function glossaryDraftFromNormalized(glossary: NormalizedGlossary): GlossaryDraft {
  return createGlossaryDraft({
    ...glossary,
    authors: glossary.authors,
    entries: glossary.entries.map(draftEntryFromNormalized),
  });
}

export function cloneGlossaryDraft(draft: Readonly<GlossaryDraft>): GlossaryDraft {
  return createGlossaryDraft({
    ...draft,
    authors: draft.authors,
    entries: draft.entries,
  });
}
