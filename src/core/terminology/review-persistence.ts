// SPDX-License-Identifier: AGPL-3.0-or-later

export type TerminologyReviewDecision = "pending" | "accepted" | "rejected" | "needs-review";
export type TerminologyCandidateKind = "term" | "phrase" | "sentence-like";
export type TerminologyVariantClassification = "form" | "alternative" | "forbidden";

export interface TerminologyReviewCorpusFile {
  filename: string;
  languageCode: string;
  text: string;
}

export interface TerminologyReviewState {
  decisions: Record<string, TerminologyReviewDecision>;
  candidateKinds: Record<string, TerminologyCandidateKind>;
  reviewedSources: Record<string, string>;
  preferredVariants: Record<string, Record<string, string>>;
  variantClassifications: Record<
    string,
    Record<string, Record<string, TerminologyVariantClassification>>
  >;
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
const VALID_CANDIDATE_KINDS = new Set<TerminologyCandidateKind>([
  "term",
  "phrase",
  "sentence-like",
]);
const VALID_VARIANT_CLASSIFICATIONS = new Set<TerminologyVariantClassification>([
  "form",
  "alternative",
  "forbidden",
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

function compactCandidateKinds(
  candidateKinds: Readonly<Record<string, TerminologyCandidateKind>>,
  validSources?: ReadonlySet<string>,
): Record<string, TerminologyCandidateKind> {
  const compact: Record<string, TerminologyCandidateKind> = {};
  for (const [source, kind] of Object.entries(candidateKinds)) {
    if ((!validSources || validSources.has(source)) && VALID_CANDIDATE_KINDS.has(kind)) {
      compact[source] = kind;
    }
  }
  return compact;
}

function compactReviewedSources(
  reviewedSources: Readonly<Record<string, string>>,
  validSources?: ReadonlySet<string>,
): Record<string, string> {
  const compact: Record<string, string> = {};
  for (const [source, value] of Object.entries(reviewedSources)) {
    if (validSources && !validSources.has(source)) continue;
    if (typeof value === "string" && value !== source) compact[source] = value;
  }
  return compact;
}

function compactVariantClassifications(
  classifications: TerminologyReviewState["variantClassifications"],
  validSources?: ReadonlySet<string>,
): TerminologyReviewState["variantClassifications"] {
  const compact: TerminologyReviewState["variantClassifications"] = {};
  for (const [source, languages] of Object.entries(classifications)) {
    if (validSources && !validSources.has(source)) continue;
    if (!languages || typeof languages !== "object") continue;

    const compactLanguages: Record<string, Record<string, TerminologyVariantClassification>> = {};
    for (const [languageCode, values] of Object.entries(languages)) {
      const normalizedCode = languageCode.trim();
      if (!normalizedCode || !values || typeof values !== "object") continue;

      const compactValues: Record<string, TerminologyVariantClassification> = {};
      for (const [value, classification] of Object.entries(values)) {
        const normalizedValue = value.trim();
        if (normalizedValue && VALID_VARIANT_CLASSIFICATIONS.has(classification)) {
          compactValues[normalizedValue] = classification;
        }
      }
      if (Object.keys(compactValues).length > 0) compactLanguages[normalizedCode] = compactValues;
    }
    if (Object.keys(compactLanguages).length > 0) compact[source] = compactLanguages;
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
    return {
      decisions: {},
      candidateKinds: {},
      reviewedSources: {},
      preferredVariants: {},
      variantClassifications: {},
    };
  }

  return {
    decisions: compactDecisions(stored.decisions ?? {}, validSources),
    candidateKinds: compactCandidateKinds(stored.candidateKinds ?? {}, validSources),
    reviewedSources: compactReviewedSources(stored.reviewedSources ?? {}, validSources),
    preferredVariants: compactPreferredVariants(stored.preferredVariants ?? {}, validSources),
    variantClassifications: compactVariantClassifications(
      stored.variantClassifications ?? {},
      validSources,
    ),
  };
}

export function saveTerminologyReviewState(
  sessionId: string,
  state: Readonly<TerminologyReviewState>,
  storage: Storage = localStorage,
): boolean {
  try {
    const decisions = compactDecisions(state.decisions);
    const candidateKinds = compactCandidateKinds(state.candidateKinds);
    const reviewedSources = compactReviewedSources(state.reviewedSources);
    const preferredVariants = compactPreferredVariants(state.preferredVariants);
    const variantClassifications = compactVariantClassifications(state.variantClassifications);
    const store = readStore(storage);

    if (
      Object.keys(decisions).length === 0 &&
      Object.keys(candidateKinds).length === 0 &&
      Object.keys(reviewedSources).length === 0 &&
      Object.keys(preferredVariants).length === 0 &&
      Object.keys(variantClassifications).length === 0
    ) {
      delete store.sessions[sessionId];
    } else {
      store.sessions[sessionId] = {
        updatedAt: Date.now(),
        decisions,
        candidateKinds,
        reviewedSources,
        preferredVariants,
        variantClassifications,
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
      candidateKinds: current.candidateKinds,
      reviewedSources: current.reviewedSources,
      preferredVariants: current.preferredVariants,
      variantClassifications: current.variantClassifications,
    },
    storage,
  );
}
