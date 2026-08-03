// SPDX-License-Identifier: AGPL-3.0-or-later
import { parseLangFile } from "../lang/parse";

export const TERMINOLOGY_CANDIDATE_EXPORT_VERSION = 1 as const;

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

interface SourceOccurrence {
  key: string;
  section: string;
  source: string;
}

function isMeaningfulCandidate(value: string): boolean {
  const withoutPlaceholders = value
    .replace(/<[^>]*>/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\$\{[^}]*\}/g, " ")
    .replace(/%\d*\$?[a-z]/gi, " ")
    .replace(/\\n/g, " ");
  return /\p{L}/u.test(withoutPlaceholders);
}

function collectOccurrences(file: TerminologyCorpusFile): SourceOccurrence[] {
  const parsed = parseLangFile(file.text);
  return parsed.items.flatMap((item) => {
    if (item.type !== "entry" || item.wasMissing || !isMeaningfulCandidate(item.value)) return [];
    return [{ key: item.key, section: item.section, source: item.value }];
  });
}

function buildTargetMap(file: TerminologyCorpusFile): Map<string, SourceOccurrence> {
  return new Map(collectOccurrences(file).map((entry) => [entry.key, entry]));
}

function sortVariants(variants: TerminologyVariant[]): TerminologyVariant[] {
  return variants.sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.value.localeCompare(right.value);
  });
}

export function extractTerminologyCandidates(
  sourceFile: TerminologyCorpusFile,
  translatedFiles: TerminologyCorpusFile[],
  options: ExtractTerminologyOptions = {},
): TerminologyCandidate[] {
  const minimumSourceFrequency = options.includeSingleOccurrences
    ? 1
    : Math.max(2, options.minimumSourceFrequency ?? 2);
  const sourceGroups = new Map<string, SourceOccurrence[]>();

  for (const occurrence of collectOccurrences(sourceFile)) {
    const group = sourceGroups.get(occurrence.source) ?? [];
    group.push(occurrence);
    sourceGroups.set(occurrence.source, group);
  }

  const targetMaps = translatedFiles.map((file) => ({ file, entries: buildTargetMap(file) }));
  const candidates: TerminologyCandidate[] = [];

  for (const [source, sourceOccurrences] of sourceGroups) {
    if (sourceOccurrences.length < minimumSourceFrequency) continue;

    const sourceKeys = sourceOccurrences.map((entry) => entry.key);
    const evidence: TerminologyEvidence[] = [];
    const languages: TerminologyLanguageResult[] = targetMaps.map(({ file, entries }) => {
      const variantEvidence = new Map<string, string[]>();

      for (const sourceOccurrence of sourceOccurrences) {
        const targetOccurrence = entries.get(sourceOccurrence.key);
        if (!targetOccurrence || !isMeaningfulCandidate(targetOccurrence.source)) continue;
        const keys = variantEvidence.get(targetOccurrence.source) ?? [];
        keys.push(sourceOccurrence.key);
        variantEvidence.set(targetOccurrence.source, keys);
        evidence.push({
          key: sourceOccurrence.key,
          section: sourceOccurrence.section,
          source,
          target: targetOccurrence.source,
        });
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
        languageCode: file.languageCode,
        filename: file.filename,
        matchedCount,
        variants,
        dominantVariant: dominant?.value ?? null,
        dominantRatio: dominant?.ratio ?? 0,
        hasConflict: variants.length > 1,
      };
    });

    candidates.push({
      source,
      sourceFrequency: sourceOccurrences.length,
      sourceKeys,
      sections: [...new Set(sourceOccurrences.map((entry) => entry.section))],
      languages,
      evidence,
    });
  }

  return candidates.sort((left, right) => {
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
