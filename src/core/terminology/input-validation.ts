// SPDX-License-Identifier: AGPL-3.0-or-later
import { parseLangFile } from "../lang/parse";
import type { TerminologyCorpusFile } from "./extract-candidates";

export type TerminologyInputProblemCode =
  | "invalid-source-language"
  | "invalid-target-language"
  | "source-target-language-match"
  | "duplicate-target-language"
  | "duplicate-target-file"
  | "source-file-used-as-target"
  | "no-aligned-entries";

export interface TerminologyInputProblem {
  code: TerminologyInputProblemCode;
  filename?: string;
  languageCode?: string;
}

const LANGUAGE_TAG_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;

function normalizedCode(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function normalizedFilename(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function entryKeys(file: TerminologyCorpusFile): Set<string> {
  return new Set(
    parseLangFile(file.text).items.flatMap((item) =>
      item.type === "entry" && !item.wasMissing ? [item.key] : [],
    ),
  );
}

export function isValidTerminologyLanguageCode(value: string): boolean {
  return LANGUAGE_TAG_PATTERN.test(value.trim());
}

export function validateTerminologyInputs(
  sourceFile: TerminologyCorpusFile,
  translatedFiles: readonly TerminologyCorpusFile[],
): TerminologyInputProblem[] {
  const problems: TerminologyInputProblem[] = [];
  const sourceCode = normalizedCode(sourceFile.languageCode);
  const sourceName = normalizedFilename(sourceFile.filename);

  if (!isValidTerminologyLanguageCode(sourceFile.languageCode)) {
    problems.push({
      code: "invalid-source-language",
      filename: sourceFile.filename,
      languageCode: sourceFile.languageCode,
    });
  }

  const seenCodes = new Set<string>();
  const seenFiles = new Set<string>();
  const sourceKeys = entryKeys(sourceFile);

  for (const file of translatedFiles) {
    const targetCode = normalizedCode(file.languageCode);
    const targetName = normalizedFilename(file.filename);

    if (!isValidTerminologyLanguageCode(file.languageCode)) {
      problems.push({
        code: "invalid-target-language",
        filename: file.filename,
        languageCode: file.languageCode,
      });
    }
    if (targetCode && targetCode === sourceCode) {
      problems.push({
        code: "source-target-language-match",
        filename: file.filename,
        languageCode: file.languageCode,
      });
    }
    if (targetCode && seenCodes.has(targetCode)) {
      problems.push({
        code: "duplicate-target-language",
        filename: file.filename,
        languageCode: file.languageCode,
      });
    }
    if (targetName && seenFiles.has(targetName)) {
      problems.push({ code: "duplicate-target-file", filename: file.filename });
    }
    if (targetName && targetName === sourceName) {
      problems.push({ code: "source-file-used-as-target", filename: file.filename });
    }

    seenCodes.add(targetCode);
    seenFiles.add(targetName);

    const aligned = [...entryKeys(file)].some((key) => sourceKeys.has(key));
    if (!aligned) {
      problems.push({
        code: "no-aligned-entries",
        filename: file.filename,
        languageCode: file.languageCode,
      });
    }
  }

  return problems;
}
