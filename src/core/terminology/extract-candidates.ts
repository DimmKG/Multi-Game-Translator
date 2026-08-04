// SPDX-License-Identifier: AGPL-3.0-or-later
import { parseLangFile } from "../lang/parse";
import {
  alignPhraseFamily,
  discoverPhraseFamilies,
  type PhraseFamilyTermPair,
} from "./phrase-families";

export const TERMINOLOGY_CANDIDATE_EXPORT_VERSION = 1 as const;

const MAX_CANDIDATE_LENGTH = 80;
const MAX_CANDIDATE_WORDS = 6;
const TOKEN_PATTERN =
  /<[^>]*>|\$\{[^}]*\}|\{[^}]*\}|%\d*\$?[a-z]|§(?:#[0-9a-f]{6}|[0-9a-fk-or])|\\n/iu;
const SENTENCE_END_PATTERN = /[.!?…]\s*$/u;

export interface TerminologyCorpusFile {
  languageCode: string;
  filename: string;
  text: string;
}

export interface TerminologyEvidence {
  key: string;
  section: string;
  source: string;
  target: string;
}

export interface TerminologyVariant {
  value: string;
  count: number;
  ratio: number;
  evidenceKeys: string[];
}

export interface TerminologyLanguageResult {
  languageCode: string;
  filename: string;
  matchedCount: number;
  variants: TerminologyVariant[];
  dominantVariant: string | null;
  dominantRatio: number;
  hasConflict: boolean;
}

export interface TerminologyCandidate {
  source: string;
  sourceFrequency: number;
  sourceKeys: string[];
  sections: string[];
  languages: TerminologyLanguageResult[];
  evidence: TerminologyEvidence[];
}

export interface TerminologyCandidateExport {
  format: "necesse-terminology-candidates";
  version: typeof TERMINOLOGY_CANDIDATE_EXPORT_VERSION;
  sourceLanguageCode: string;
  sourceFilename: string;
  generatedAt: string;
  candidates: TerminologyCandidate[];
}

export interface ExtractTerminologyOptions {
  minimumSourceFrequency?: number;
  includeSingleOccurrences?: boolean;
}

interface CorpusOccurrence {
  key: string;
  occurrence: number;
  identity: string;
  section: string;
  value: string;
}

interface CandidateSeed {
  source: string;
  sourceOccurrences: CorpusOccurrence[];
  translations: Map<string, PhraseFamilyTermPair>;
}

function countWords(value: string): number {
  return value.match(/\p{L}[\p{L}\p{M}'’-]*/gu)?.length ?? 0;
}

function isMeaningfulCandidate(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_CANDIDATE_LENGTH) return false;
  if (TOKEN_PATTERN.test(trimmed) || SENTENCE_END_PATTERN.test(trimmed)) return false;

  const wordCount = countWords(trimmed);
  return wordCount > 0 && wordCount <= MAX_CANDIDATE_WORDS;
}

function occurrenceIdentity(key: string, occurrence: number): string {
  return `${key}\u0000${occurrence}`;
}

function collectOccurrences(file: TerminologyCorpusFile): CorpusOccurrence[] {
  const counts = new Map<string, number>();
  return parseLangFile(file.text).items.flatMap((item) => {
    if (item.type !== "entry" || item.wasMissing) return [];
    const occurrence = counts.get(item.key) ?? 0;
    counts.set(item.key, occurrence + 1);
    return [
      {
        key: item.key,
        occurrence,
        identity: occurrenceIdentity(item.key, occurrence),
        section: item.section ?? "",
        value: item.value,
      },
    ];
  });
}

function buildOccurrenceMap(entries: readonly CorpusOccurrence[]): Map<string, CorpusOccurrence> {
  return new Map(entries.map((entry) => [entry.identity, entry]));
}

function sortVariants(variants: TerminologyVariant[]): TerminologyVariant[] {
  return variants.sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.value.localeCompare(right.value);
  });
}

function upsertSeed(seeds: Map<string, CandidateSeed>, seed: CandidateSeed): void {
  const existing = seeds.get(seed.source);
  if (!existing) {
    seeds.set(seed.source, seed);
    return;
  }

  const identities = new Set(existing.sourceOccurrences.map((entry) => entry.identity));
  for (const occurrence of seed.sourceOccurrences) {
    if (!identities.has(occurrence.identity)) existing.sourceOccurrences.push(occurrence);
  }
  for (const [languageCode, translation] of seed.translations) {
    if (!existing.translations.has(languageCode)) {
      existing.translations.set(languageCode, translation);
    }
  }
}

function buildLanguageResult(
  file: TerminologyCorpusFile,
  sourceOccurrences: readonly CorpusOccurrence[],
  targetByIdentity: ReadonlyMap<string, CorpusOccurrence>,
  derivedPair?: PhraseFamilyTermPair,
): { result: TerminologyLanguageResult; evidence: TerminologyEvidence[] } {
  const variantEvidence = new Map<string, string[]>();
  const evidence: TerminologyEvidence[] = [];

  if (derivedPair) {
    const evidenceIdentities = new Set(derivedPair.evidenceKeys);
    for (const sourceOccurrence of sourceOccurrences) {
      if (!evidenceIdentities.has(sourceOccurrence.identity)) continue;
      const targetOccurrence = targetByIdentity.get(sourceOccurrence.identity);
      if (!targetOccurrence) continue;
      const keys = variantEvidence.get(derivedPair.target) ?? [];
      keys.push(sourceOccurrence.key);
      variantEvidence.set(derivedPair.target, keys);
      evidence.push({
        key: sourceOccurrence.key,
        section: sourceOccurrence.section,
        source: sourceOccurrence.value,
        target: targetOccurrence.value,
      });
    }
  } else {
    for (const sourceOccurrence of sourceOccurrences) {
      const targetOccurrence = targetByIdentity.get(sourceOccurrence.identity);
      if (!targetOccurrence || !isMeaningfulCandidate(targetOccurrence.value)) continue;
      const keys = variantEvidence.get(targetOccurrence.value) ?? [];
      keys.push(sourceOccurrence.key);
      variantEvidence.set(targetOccurrence.value, keys);
      evidence.push({
        key: sourceOccurrence.key,
        section: sourceOccurrence.section,
        source: sourceOccurrence.value,
        target: targetOccurrence.value,
      });
    }
  }

  const matchedCount = [...variantEvidence.values()].reduce(
    (total, keys) => total + keys.length,
    0,
  );
  const variants = sortVariants(
    [...variantEvidence.entries()].map(([value, evidenceKeys]) => ({
      value,
      count: evidenceKeys.length,
      ratio: matchedCount === 0 ? 0 : evidenceKeys.length / matchedCount,
      evidenceKeys,
    })),
  );
  const dominant = variants[0] ?? null;

  return {
    result: {
      languageCode: file.languageCode,
      filename: file.filename,
      matchedCount,
      variants,
      dominantVariant: dominant?.value ?? null,
      dominantRatio: dominant?.ratio ?? 0,
      hasConflict: variants.length > 1,
    },
    evidence,
  };
}

export function extractTerminologyCandidates(
  sourceFile: TerminologyCorpusFile,
  translatedFiles: TerminologyCorpusFile[],
  options: ExtractTerminologyOptions = {},
): TerminologyCandidate[] {
  const minimumSourceFrequency = options.includeSingleOccurrences
    ? 1
    : Math.max(2, options.minimumSourceFrequency ?? 2);
  const sourceOccurrences = collectOccurrences(sourceFile);
  const sourceByIdentity = buildOccurrenceMap(sourceOccurrences);
  const translated = translatedFiles.map((file) => {
    const occurrences = collectOccurrences(file);
    return { file, occurrences, byIdentity: buildOccurrenceMap(occurrences) };
  });
  const seeds = new Map<string, CandidateSeed>();

  const exactGroups = new Map<string, CorpusOccurrence[]>();
  for (const occurrence of sourceOccurrences) {
    if (!isMeaningfulCandidate(occurrence.value)) continue;
    const group = exactGroups.get(occurrence.value) ?? [];
    group.push(occurrence);
    exactGroups.set(occurrence.value, group);
  }
  for (const [source, occurrences] of exactGroups) {
    if (occurrences.length < minimumSourceFrequency) continue;
    upsertSeed(seeds, {
      source,
      sourceOccurrences: [...occurrences],
      translations: new Map(),
    });
  }

  const sourceFamilies = discoverPhraseFamilies(
    sourceOccurrences.map((entry) => ({
      key: entry.identity,
      occurrence: entry.occurrence,
      value: entry.value,
    })),
  );

  for (const family of sourceFamilies) {
    if (family.supportKeys.length < minimumSourceFrequency) continue;
    const familyOccurrences = family.supportKeys.flatMap((identity) => {
      const occurrence = sourceByIdentity.get(identity);
      return occurrence ? [occurrence] : [];
    });
    if (familyOccurrences.length < minimumSourceFrequency) continue;

    const alignedByLanguage = new Map<string, ReturnType<typeof alignPhraseFamily>>();
    for (const target of translated) {
      alignedByLanguage.set(
        target.file.languageCode,
        alignPhraseFamily(
          family,
          target.occurrences.map((entry) => ({
            key: entry.identity,
            occurrence: entry.occurrence,
            value: entry.value,
          })),
        ),
      );
    }

    const baseTranslations = new Map<string, PhraseFamilyTermPair>();
    for (const [languageCode, aligned] of alignedByLanguage) {
      if (aligned) baseTranslations.set(languageCode, aligned.base);
    }
    if (baseTranslations.size > 0) {
      upsertSeed(seeds, {
        source: family.base,
        sourceOccurrences: familyOccurrences,
        translations: baseTranslations,
      });
    }

    const modifierSources = new Set(
      [...alignedByLanguage.values()].flatMap((aligned) =>
        aligned ? aligned.modifiers.map((modifier) => modifier.source) : [],
      ),
    );
    for (const modifierSource of modifierSources) {
      const translations = new Map<string, PhraseFamilyTermPair>();
      let modifierOccurrences: CorpusOccurrence[] = [];
      for (const [languageCode, aligned] of alignedByLanguage) {
        const modifier = aligned?.modifiers.find((item) => item.source === modifierSource);
        if (!modifier) continue;
        translations.set(languageCode, modifier);
        if (modifierOccurrences.length === 0) {
          modifierOccurrences = modifier.evidenceKeys.flatMap((identity) => {
            const occurrence = sourceByIdentity.get(identity);
            return occurrence ? [occurrence] : [];
          });
        }
      }
      if (translations.size > 0 && modifierOccurrences.length > 0) {
        upsertSeed(seeds, {
          source: modifierSource,
          sourceOccurrences: modifierOccurrences,
          translations,
        });
      }
    }
  }

  return [...seeds.values()]
    .map((seed) => {
      const evidence: TerminologyEvidence[] = [];
      const languages = translated.map((target) => {
        const built = buildLanguageResult(
          target.file,
          seed.sourceOccurrences,
          target.byIdentity,
          seed.translations.get(target.file.languageCode),
        );
        evidence.push(...built.evidence);
        return built.result;
      });

      return {
        source: seed.source,
        sourceFrequency: seed.sourceOccurrences.length,
        sourceKeys: seed.sourceOccurrences.map((entry) => entry.key),
        sections: [...new Set(seed.sourceOccurrences.map((entry) => entry.section))],
        languages,
        evidence,
      };
    })
    .filter((candidate) => candidate.languages.some((language) => language.matchedCount > 0))
    .sort((left, right) => {
      if (right.sourceFrequency !== left.sourceFrequency) {
        return right.sourceFrequency - left.sourceFrequency;
      }
      return left.source.localeCompare(right.source);
    });
}

export function buildTerminologyCandidateExport(
  sourceFile: TerminologyCorpusFile,
  candidates: TerminologyCandidate[],
  generatedAt = new Date().toISOString(),
): TerminologyCandidateExport {
  return {
    format: "necesse-terminology-candidates",
    version: TERMINOLOGY_CANDIDATE_EXPORT_VERSION,
    sourceLanguageCode: sourceFile.languageCode,
    sourceFilename: sourceFile.filename,
    generatedAt,
    candidates,
  };
}
