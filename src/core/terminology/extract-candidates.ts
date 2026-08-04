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
  /<[^>]*>|\[[^\]]*\]|\$\{[^}]*\}|\{[^}]*\}|%\d*\$?[a-z]|§(?:#[0-9a-f]{6}|[0-9a-fk-or])|\\n/iu;
const SENTENCE_END_PATTERN = /[.!?…]\s*$/u;
const WORD_PATTERN = /\p{L}[\p{L}\p{M}'’-]*/gu;

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
  directOccurrences: CorpusOccurrence[];
  translations: Map<string, PhraseFamilyTermPair>;
}

function countWords(value: string): number {
  return value.match(WORD_PATTERN)?.length ?? 0;
}

function normalizeCandidate(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function phraseBoundaries(
  value: string,
  phrase: string,
): { atStart: boolean; atEnd: boolean } | null {
  const normalizedValue = value.toLocaleLowerCase();
  const normalizedPhrase = phrase.toLocaleLowerCase();
  const index = normalizedValue.indexOf(normalizedPhrase);
  if (index < 0) return null;

  return {
    atStart: !/\p{L}/u.test(normalizedValue.slice(0, index)),
    atEnd: !/\p{L}/u.test(normalizedValue.slice(index + normalizedPhrase.length)),
  };
}

function hasStableAlignedBoundaries(
  pair: PhraseFamilyTermPair,
  sourceByIdentity: ReadonlyMap<string, CorpusOccurrence>,
  targetByIdentity: ReadonlyMap<string, CorpusOccurrence>,
): boolean {
  return pair.evidenceKeys.every((identity) => {
    const source = sourceByIdentity.get(identity);
    const target = targetByIdentity.get(identity);
    if (!source || !target) return false;

    const sourceBoundaries = phraseBoundaries(source.value, pair.source);
    const targetBoundaries = phraseBoundaries(target.value, pair.target);
    if (!sourceBoundaries || !targetBoundaries) return false;
    if (!sourceBoundaries.atStart && !sourceBoundaries.atEnd) return false;
    if (!targetBoundaries.atStart && !targetBoundaries.atEnd) return false;

    return (
      sourceBoundaries.atStart === targetBoundaries.atStart &&
      sourceBoundaries.atEnd === targetBoundaries.atEnd
    );
  });
}

function isTitleCasedMultiWordCandidate(value: string): boolean {
  const words = value.match(WORD_PATTERN) ?? [];
  if (words.length < 2) return false;

  return words.every((word) => {
    const initial = word[0];
    return initial === initial.toLocaleUpperCase() && initial !== initial.toLocaleLowerCase();
  });
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
  const directIdentities = new Set(existing.directOccurrences.map((entry) => entry.identity));
  for (const occurrence of seed.directOccurrences) {
    if (!directIdentities.has(occurrence.identity)) existing.directOccurrences.push(occurrence);
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
  const exactSourceValues = new Set(
    sourceOccurrences.map((occurrence) => normalizeCandidate(occurrence.value)),
  );
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
      directOccurrences: [...occurrences],
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
    if (!isMeaningfulCandidate(family.base)) continue;

    const familyOccurrences = family.supportKeys.flatMap((identity) => {
      const occurrence = sourceByIdentity.get(identity);
      return occurrence ? [occurrence] : [];
    });
    if (familyOccurrences.length < minimumSourceFrequency) continue;
    if (familyOccurrences.some((occurrence) => TOKEN_PATTERN.test(occurrence.value))) continue;

    const hasExactSourceValue = familyOccurrences.some(
      (occurrence) => normalizeCandidate(occurrence.value) === normalizeCandidate(family.base),
    );
    if (!hasExactSourceValue && !isTitleCasedMultiWordCandidate(family.base)) continue;
    if (
      !familyOccurrences.some(
        (occurrence) => countWords(occurrence.value) > countWords(family.base),
      )
    ) {
      continue;
    }

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
      const target = translated.find((item) => item.file.languageCode === languageCode);
      if (
        aligned &&
        target &&
        isMeaningfulCandidate(aligned.base.target) &&
        (hasExactSourceValue ||
          hasStableAlignedBoundaries(aligned.base, sourceByIdentity, target.byIdentity))
      ) {
        baseTranslations.set(languageCode, aligned.base);
      }
    }
    if (baseTranslations.size > 0) {
      upsertSeed(seeds, {
        source: family.base,
        sourceOccurrences: familyOccurrences,
        directOccurrences: [],
        translations: baseTranslations,
      });
    }

    const modifierSources = new Set(
      [...alignedByLanguage.values()].flatMap((aligned) =>
        aligned
          ? aligned.modifiers
              .filter(
                (modifier) =>
                  isMeaningfulCandidate(modifier.source) && isMeaningfulCandidate(modifier.target),
              )
              .map((modifier) => modifier.source)
          : [],
      ),
    );
    for (const modifierSource of modifierSources) {
      if (
        !exactSourceValues.has(normalizeCandidate(modifierSource)) &&
        !isTitleCasedMultiWordCandidate(modifierSource)
      ) {
        continue;
      }

      const translations = new Map<string, PhraseFamilyTermPair>();
      let modifierOccurrences: CorpusOccurrence[] = [];
      for (const [languageCode, aligned] of alignedByLanguage) {
        const target = translated.find((item) => item.file.languageCode === languageCode);
        const modifier = aligned?.modifiers.find(
          (item) =>
            item.source === modifierSource &&
            isMeaningfulCandidate(item.source) &&
            isMeaningfulCandidate(item.target),
        );
        if (
          !modifier ||
          !target ||
          (!exactSourceValues.has(normalizeCandidate(modifierSource)) &&
            !hasStableAlignedBoundaries(modifier, sourceByIdentity, target.byIdentity))
        ) {
          continue;
        }
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
          directOccurrences: [],
          translations,
        });
      }
    }
  }

  return [...seeds.values()]
    .filter((seed) => seed.sourceOccurrences.length >= minimumSourceFrequency)
    .map((seed) => {
      const evidence: TerminologyEvidence[] = [];
      const languages = translated.map((target) => {
        const derivedPair = seed.translations.get(target.file.languageCode);
        const built = buildLanguageResult(
          target.file,
          derivedPair ? seed.sourceOccurrences : seed.directOccurrences,
          target.byIdentity,
          derivedPair,
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
