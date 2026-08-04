// SPDX-License-Identifier: AGPL-3.0-or-later

export type TerminologyReviewDecision = "pending" | "accepted" | "rejected" | "needs-review";

export interface TerminologyReviewCorpusFile {
  filename: string;
  languageCode: string;
  text: string;
}

export interface TerminologyReviewState {
  decisions: Record<string, TerminologyReviewDecision>;
  preferredVariants: Record<string, Record<string, string>>;
}

interface StoredReviewSession extends TerminologyReviewState {
  updatedAt: number;
}

interface StoredReviewSessions {
  version: 1;
  sessions: Record<string, StoredReviewSession>;
}

const STORAGE_KEY = "necesse-translator.terminology-review.v1";
const MAX_SESSIONS = 12;
const VALID_DECISIONS = new Set<TerminologyReviewDecision>([
  "accepted",
  "rejected",
  "needs-review",
]);

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function fileFingerprint(file: TerminologyReviewCorpusFile): string {
  const sampleSize = 2048;
  const start = file.text.slice(0, sampleSize);
  const end = file.text.slice(-sampleSize);
  return [
    file.filename.trim().toLocaleLowerCase(),
    file.languageCode.trim().toLocaleLowerCase(),
    file.text.length,
    hashString(`${start}\u0000${end}`),
  ].join(":");
}

export function buildTerminologyReviewSessionId(
  source: TerminologyReviewCorpusFile,
  translations: readonly TerminologyReviewCorpusFile[],
  minimumFrequency: number,
): string {
  const translationFingerprints = translations.map(fileFingerprint).sort();
  return hashString(
    [
      "v1",
      fileFingerprint(source),
      String(Math.max(1, Math.trunc(minimumFrequency))),
      ...translationFingerprints,
    ].join("\u0001"),
  );
}

function emptyStore(): StoredReviewSessions {
  return { version: 1, sessions: {} };
}

function readStore(storage: Storage): StoredReviewSessions {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "null") as unknown;
    if (!parsed || typeof parsed !== "object") return emptyStore();
    const candidate = parsed as Partial<StoredReviewSessions>;
    if (candidate.version !== 1 || !candidate.sessions || typeof candidate.sessions !== "object") {
      return emptyStore();
    }
    return { version: 1, sessions: candidate.sessions };
  } catch {
    return emptyStore();
  }
}

function compactDecisions(
  decisions: Readonly<Record<string, TerminologyReviewDecision>>,
  validSources?: ReadonlySet<string>,
): Record<string, TerminologyReviewDecision> {
  const compact: Record<string, TerminologyReviewDecision> = {};
  for (const [source, decision] of Object.entries(decisions)) {
    if ((!validSources || validSources.has(source)) && VALID_DECISIONS.has(decision)) {
      compact[source] = decision;
    }
  }
  return compact;
}

function compactPreferredVariants(
  preferredVariants: Readonly<Record<string, Readonly<Record<string, string>>>>,
  validSources?: ReadonlySet<string>,
): Record<string, Record<string, string>> {
  const compact: Record<string, Record<string, string>> = {};
  for (const [source, languages] of Object.entries(preferredVariants)) {
    if (validSources && !validSources.has(source)) continue;
    if (!languages || typeof languages !== "object") continue;

    const preferredByLanguage: Record<string, string> = {};
    for (const [languageCode, value] of Object.entries(languages)) {
      const normalizedCode = languageCode.trim();
      const normalizedValue = typeof value === "string" ? value.trim() : "";
      if (normalizedCode && normalizedValue) preferredByLanguage[normalizedCode] = normalizedValue;
    }
    if (Object.keys(preferredByLanguage).length > 0) compact[source] = preferredByLanguage;
  }
  return compact;
}

export function loadTerminologyReviewState(
  sessionId: string,
  validSources: ReadonlySet<string>,
  storage: Storage = localStorage,
): TerminologyReviewState {
  const stored = readStore(storage).sessions[sessionId];
  if (!stored || typeof stored !== "object") {
    return { decisions: {}, preferredVariants: {} };
  }

  return {
    decisions: compactDecisions(stored.decisions ?? {}, validSources),
    preferredVariants: compactPreferredVariants(stored.preferredVariants ?? {}, validSources),
  };
}

export function saveTerminologyReviewState(
  sessionId: string,
  state: Readonly<TerminologyReviewState>,
  storage: Storage = localStorage,
): boolean {
  try {
    const decisions = compactDecisions(state.decisions);
    const preferredVariants = compactPreferredVariants(state.preferredVariants);
    const store = readStore(storage);

    if (Object.keys(decisions).length === 0 && Object.keys(preferredVariants).length === 0) {
      delete store.sessions[sessionId];
    } else {
      store.sessions[sessionId] = {
        updatedAt: Date.now(),
        decisions,
        preferredVariants,
      };
    }

    const retained = Object.entries(store.sessions)
      .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_SESSIONS);
    store.sessions = Object.fromEntries(retained);
    storage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function loadTerminologyReviewDecisions(
  sessionId: string,
  validSources: ReadonlySet<string>,
  storage: Storage = localStorage,
): Record<string, TerminologyReviewDecision> {
  return loadTerminologyReviewState(sessionId, validSources, storage).decisions;
}

export function saveTerminologyReviewDecisions(
  sessionId: string,
  decisions: Readonly<Record<string, TerminologyReviewDecision>>,
  storage: Storage = localStorage,
): boolean {
  const current = loadTerminologyReviewState(sessionId, new Set(Object.keys(decisions)), storage);
  return saveTerminologyReviewState(
    sessionId,
    {
      decisions: { ...current.decisions, ...decisions },
      preferredVariants: current.preferredVariants,
    },
    storage,
  );
}
