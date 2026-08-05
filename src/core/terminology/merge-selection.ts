// SPDX-License-Identifier: AGPL-3.0-or-later

export interface TerminologyMergeGlossaryOption {
  id: string;
  sourceLanguage: string;
  targetLanguage: string;
}

function normalizedLanguage(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function compatibleTerminologyGlossaries<T extends TerminologyMergeGlossaryOption>(
  glossaries: readonly T[],
  sourceLanguage: string,
  targetLanguages: ReadonlySet<string>,
): T[] {
  const normalizedSource = normalizedLanguage(sourceLanguage);
  const normalizedTargets = new Set(
    [...targetLanguages].map((language) => normalizedLanguage(language)),
  );
  return glossaries.filter(
    (glossary) =>
      normalizedLanguage(glossary.sourceLanguage) === normalizedSource &&
      normalizedTargets.has(normalizedLanguage(glossary.targetLanguage)),
  );
}

export function chooseTerminologyMergeTarget(
  currentId: string,
  compatibleIds: readonly string[],
): string {
  if (compatibleIds.includes(currentId)) return currentId;
  return compatibleIds.length === 1 ? compatibleIds[0] : "";
}
