// SPDX-License-Identifier: AGPL-3.0-or-later

import { GLOSSARY_FORMAT, GLOSSARY_FORMAT_VERSION } from "./contract";
import {
  cloneGlossaryDraft,
  createGlossaryDraft,
  createGlossaryDraftEntry,
  glossaryDraftFromNormalized,
  type GlossaryDraft,
  type GlossaryDraftEntry,
  type GlossaryDraftInput,
} from "./draft";
import { normalizeGlossary, parseJsonDocument, type NormalizedGlossary } from "./loader";
import { serializeGlossaryDraft } from "./serializer";
import { validateGlossaryDocument, type GlossaryValidationResult } from "./validation";

export const GLOSSARY_AUTHORING_RECOVERY_KEY = "necesse-translator.glossary-authoring.v1";

export type GlossaryAuthoringOrigin = "new" | "imported" | "library";

export interface GlossaryAuthoringSession {
  draft: GlossaryDraft;
  origin: GlossaryAuthoringOrigin;
  savedFingerprint: string | null;
  lastBoundaryDate: string;
}

export interface GlossaryAuthoringBoundaryResult {
  session: GlossaryAuthoringSession;
  glossary: NormalizedGlossary;
  serialized: string;
}

interface StoredGlossaryAuthoringSession {
  version: 1;
  session: GlossaryAuthoringSession;
}

function draftFingerprint(draft: Readonly<GlossaryDraft>): string {
  return JSON.stringify({
    format: draft.format,
    version: draft.version,
    id: draft.id,
    name: draft.name,
    sourceLanguage: draft.sourceLanguage,
    targetLanguage: draft.targetLanguage,
    game: draft.game,
    authors: draft.authors,
    entries: draft.entries,
  });
}

function sessionFromDraft(
  draft: GlossaryDraft,
  origin: GlossaryAuthoringOrigin,
  savedFingerprint: string | null,
): GlossaryAuthoringSession {
  return {
    draft,
    origin,
    savedFingerprint,
    lastBoundaryDate: draft.updatedAt,
  };
}

export function createNewGlossaryAuthoringSession(
  input: GlossaryDraftInput = {},
): GlossaryAuthoringSession {
  return sessionFromDraft(createGlossaryDraft(input), "new", null);
}

export function importGlossaryAuthoringSession(
  text: string,
  label = "glossary",
): GlossaryAuthoringSession {
  const normalized = normalizeGlossary(parseJsonDocument(text, label));
  return sessionFromDraft(glossaryDraftFromNormalized(normalized), "imported", null);
}

export function openGlossaryAuthoringSession(
  glossary: NormalizedGlossary,
): GlossaryAuthoringSession {
  const draft = glossaryDraftFromNormalized(glossary);
  return sessionFromDraft(draft, "library", draftFingerprint(draft));
}

export function updateGlossaryAuthoringSession(
  session: Readonly<GlossaryAuthoringSession>,
  update: (draft: GlossaryDraft) => void,
): GlossaryAuthoringSession {
  const draft = cloneGlossaryDraft(session.draft);
  update(draft);
  return { ...session, draft };
}

export function isGlossaryAuthoringSessionDirty(
  session: Readonly<GlossaryAuthoringSession>,
): boolean {
  return (
    session.savedFingerprint === null ||
    session.savedFingerprint !== draftFingerprint(session.draft)
  );
}

export function validateGlossaryAuthoringSession(
  session: Readonly<GlossaryAuthoringSession>,
): GlossaryValidationResult {
  return validateGlossaryDocument(session.draft);
}

export function saveGlossaryAuthoringSession(
  session: Readonly<GlossaryAuthoringSession>,
  boundaryDate: string,
): GlossaryAuthoringBoundaryResult {
  const serialized = serializeGlossaryDraft(session.draft, boundaryDate);
  const glossary = normalizeGlossary(JSON.parse(serialized));
  const draft = glossaryDraftFromNormalized(glossary);
  return {
    session: sessionFromDraft(draft, "library", draftFingerprint(draft)),
    glossary,
    serialized,
  };
}

export function exportGlossaryAuthoringSession(
  session: Readonly<GlossaryAuthoringSession>,
  boundaryDate: string,
): GlossaryAuthoringBoundaryResult {
  const serialized = serializeGlossaryDraft(session.draft, boundaryDate);
  const glossary = normalizeGlossary(JSON.parse(serialized));
  const draft = glossaryDraftFromNormalized(glossary);
  return {
    session: {
      ...session,
      draft,
      lastBoundaryDate: boundaryDate,
    },
    glossary,
    serialized,
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function decodeDraftEntry(value: unknown): GlossaryDraftEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entry = value as Record<string, unknown>;
  if (
    typeof entry.source !== "string" ||
    typeof entry.target !== "string" ||
    !isStringArray(entry.forms) ||
    !isStringArray(entry.alternatives) ||
    !isStringArray(entry.forbidden) ||
    typeof entry.caseSensitive !== "boolean" ||
    typeof entry.wholeWord !== "boolean" ||
    typeof entry.status !== "string" ||
    typeof entry.category !== "string" ||
    typeof entry.context !== "string" ||
    typeof entry.note !== "string"
  ) {
    return null;
  }
  return createGlossaryDraftEntry({
    source: entry.source,
    target: entry.target,
    forms: entry.forms,
    alternatives: entry.alternatives,
    forbidden: entry.forbidden,
    caseSensitive: entry.caseSensitive,
    wholeWord: entry.wholeWord,
    status: entry.status,
    category: entry.category,
    context: entry.context,
    note: entry.note,
  });
}

function decodeDraft(value: unknown): GlossaryDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const draft = value as Record<string, unknown>;
  if (
    draft.format !== GLOSSARY_FORMAT ||
    draft.version !== GLOSSARY_FORMAT_VERSION ||
    typeof draft.id !== "string" ||
    typeof draft.name !== "string" ||
    typeof draft.sourceLanguage !== "string" ||
    typeof draft.targetLanguage !== "string" ||
    typeof draft.game !== "string" ||
    !isStringArray(draft.authors) ||
    typeof draft.updatedAt !== "string" ||
    !Array.isArray(draft.entries)
  ) {
    return null;
  }

  const entries = draft.entries.map(decodeDraftEntry);
  if (entries.some((entry) => entry === null)) return null;
  return createGlossaryDraft({
    id: draft.id,
    name: draft.name,
    sourceLanguage: draft.sourceLanguage,
    targetLanguage: draft.targetLanguage,
    game: draft.game,
    authors: draft.authors,
    updatedAt: draft.updatedAt,
    entries: entries as GlossaryDraftEntry[],
  });
}

export function saveGlossaryAuthoringRecovery(
  session: Readonly<GlossaryAuthoringSession>,
  storage: Storage = localStorage,
): boolean {
  try {
    const stored: StoredGlossaryAuthoringSession = {
      version: 1,
      session: {
        ...session,
        draft: cloneGlossaryDraft(session.draft),
      },
    };
    storage.setItem(GLOSSARY_AUTHORING_RECOVERY_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

export function loadGlossaryAuthoringRecovery(
  storage: Storage = localStorage,
): GlossaryAuthoringSession | null {
  try {
    const parsed = JSON.parse(
      storage.getItem(GLOSSARY_AUTHORING_RECOVERY_KEY) || "null",
    ) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const stored = parsed as Record<string, unknown>;
    if (stored.version !== 1 || !stored.session || typeof stored.session !== "object") return null;

    const candidate = stored.session as Record<string, unknown>;
    const draft = decodeDraft(candidate.draft);
    if (
      !draft ||
      !["new", "imported", "library"].includes(String(candidate.origin)) ||
      (candidate.savedFingerprint !== null && typeof candidate.savedFingerprint !== "string") ||
      typeof candidate.lastBoundaryDate !== "string"
    ) {
      return null;
    }

    return {
      draft,
      origin: candidate.origin as GlossaryAuthoringOrigin,
      savedFingerprint: candidate.savedFingerprint as string | null,
      lastBoundaryDate: candidate.lastBoundaryDate,
    };
  } catch {
    return null;
  }
}

export function clearGlossaryAuthoringRecovery(storage: Storage = localStorage): boolean {
  try {
    storage.removeItem(GLOSSARY_AUTHORING_RECOVERY_KEY);
    return true;
  } catch {
    return false;
  }
}
