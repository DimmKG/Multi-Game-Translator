// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  GLOSSARY_FORMAT,
  GLOSSARY_FORMAT_VERSION,
  isGlossaryEntryStatus,
  isGlossaryId,
  isGlossaryLanguageTag,
  isIsoDate,
} from "./contract.ts";

export type GlossaryValidationSeverity = "error" | "warning";

export type GlossaryValidationCode =
  | "document-not-object"
  | "unsupported-format"
  | "unsupported-version"
  | "invalid-id"
  | "name-required"
  | "invalid-source-language"
  | "invalid-target-language"
  | "game-empty"
  | "authors-invalid"
  | "author-empty"
  | "duplicate-author"
  | "updated-at-invalid"
  | "entries-invalid"
  | "entry-invalid"
  | "source-required"
  | "target-required"
  | "array-invalid"
  | "array-empty-value"
  | "array-duplicate-value"
  | "boolean-invalid"
  | "unsupported-status"
  | "preferred-forbidden-conflict"
  | "ambiguous-duplicate-entry"
  | "missing-authors"
  | "empty-glossary"
  | "duplicate-source-context"
  | "duplicate-entry"
  | "source-target-identical"
  | "alternative-forbidden-overlap"
  | "one-character-source"
  | "short-non-whole-word"
  | "missing-category"
  | "context-dependent-missing-context";

export interface GlossaryValidationProblem {
  severity: GlossaryValidationSeverity;
  code: GlossaryValidationCode;
  path: string;
  entryIndex?: number;
  relatedEntryIndex?: number;
  value?: string;
}

export interface GlossaryValidationResult {
  valid: boolean;
  errors: GlossaryValidationProblem[];
  warnings: GlossaryValidationProblem[];
  problems: GlossaryValidationProblem[];
}

type UnknownRecord = Record<string, unknown>;

const ENTRY_ARRAY_FIELDS = ["forms", "alternatives", "forbidden"] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function addProblem(
  problems: GlossaryValidationProblem[],
  severity: GlossaryValidationSeverity,
  code: GlossaryValidationCode,
  path: string,
  details: Omit<GlossaryValidationProblem, "severity" | "code" | "path"> = {},
) {
  problems.push({ severity, code, path, ...details });
}

function comparable(value: string, caseSensitive: boolean): string {
  return caseSensitive ? value : value.toLocaleLowerCase();
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateStringArray(
  entry: UnknownRecord,
  field: (typeof ENTRY_ARRAY_FIELDS)[number],
  index: number,
  problems: GlossaryValidationProblem[],
): string[] | null {
  const value = entry[field];
  if (value === undefined) return [];
  const path = `entries[${index}].${field}`;
  if (!Array.isArray(value)) {
    addProblem(problems, "error", "array-invalid", path, { entryIndex: index });
    return null;
  }

  const strings: string[] = [];
  const seen = new Set<string>();
  value.forEach((item, itemIndex) => {
    const itemPath = `${path}[${itemIndex}]`;
    if (!nonEmptyString(item)) {
      addProblem(problems, "error", "array-empty-value", itemPath, { entryIndex: index });
      return;
    }
    if (seen.has(item)) {
      addProblem(problems, "error", "array-duplicate-value", itemPath, {
        entryIndex: index,
        value: item,
      });
    } else {
      seen.add(item);
    }
    strings.push(item);
  });
  return strings;
}

interface ValidatableEntry {
  index: number;
  source: string;
  target: string;
  alternatives: string[];
  forbidden: string[];
  caseSensitive: boolean;
  wholeWord: boolean;
  status: string;
  context: string;
}

function validateEntry(
  value: unknown,
  index: number,
  problems: GlossaryValidationProblem[],
): ValidatableEntry | null {
  const path = `entries[${index}]`;
  if (!isRecord(value)) {
    addProblem(problems, "error", "entry-invalid", path, { entryIndex: index });
    return null;
  }

  const source = nonEmptyString(value.source) ? value.source : "";
  const target = nonEmptyString(value.target) ? value.target : "";
  if (!source)
    addProblem(problems, "error", "source-required", `${path}.source`, { entryIndex: index });
  if (!target)
    addProblem(problems, "error", "target-required", `${path}.target`, { entryIndex: index });

  const arrays = Object.fromEntries(
    ENTRY_ARRAY_FIELDS.map((field) => [field, validateStringArray(value, field, index, problems)]),
  ) as Record<(typeof ENTRY_ARRAY_FIELDS)[number], string[] | null>;

  if (value.caseSensitive !== undefined && typeof value.caseSensitive !== "boolean") {
    addProblem(problems, "error", "boolean-invalid", `${path}.caseSensitive`, {
      entryIndex: index,
    });
  }
  if (value.wholeWord !== undefined && typeof value.wholeWord !== "boolean") {
    addProblem(problems, "error", "boolean-invalid", `${path}.wholeWord`, { entryIndex: index });
  }

  const status = value.status === undefined ? "approved" : value.status;
  if (!isGlossaryEntryStatus(status)) {
    addProblem(problems, "error", "unsupported-status", `${path}.status`, { entryIndex: index });
  }

  const caseSensitive = value.caseSensitive === true;
  const wholeWord = value.wholeWord !== false;
  const category = typeof value.category === "string" ? value.category : "";
  const context = typeof value.context === "string" ? value.context : "";
  const alternatives = arrays.alternatives ?? [];
  const forbidden = arrays.forbidden ?? [];

  if (source && target && comparable(source, caseSensitive) === comparable(target, caseSensitive)) {
    addProblem(problems, "warning", "source-target-identical", `${path}.target`, {
      entryIndex: index,
    });
  }
  if (source && Array.from(source.trim()).length === 1) {
    addProblem(problems, "warning", "one-character-source", `${path}.source`, {
      entryIndex: index,
    });
  }
  if (source && !wholeWord && Array.from(source.trim()).length <= 2) {
    addProblem(problems, "warning", "short-non-whole-word", `${path}.wholeWord`, {
      entryIndex: index,
    });
  }
  if (!category.trim()) {
    addProblem(problems, "warning", "missing-category", `${path}.category`, {
      entryIndex: index,
    });
  }
  if (status === "context-dependent" && !context.trim()) {
    addProblem(problems, "warning", "context-dependent-missing-context", `${path}.context`, {
      entryIndex: index,
    });
  }

  if (target) {
    const preferred = comparable(target, caseSensitive);
    const conflicting = forbidden.find((item) => comparable(item, caseSensitive) === preferred);
    if (conflicting) {
      addProblem(problems, "error", "preferred-forbidden-conflict", `${path}.forbidden`, {
        entryIndex: index,
        value: conflicting,
      });
    }
  }

  const forbiddenValues = new Set(forbidden.map((item) => comparable(item, caseSensitive)));
  const overlap = alternatives.find((item) => forbiddenValues.has(comparable(item, caseSensitive)));
  if (overlap) {
    addProblem(problems, "warning", "alternative-forbidden-overlap", `${path}.alternatives`, {
      entryIndex: index,
      value: overlap,
    });
  }

  return {
    index,
    source,
    target,
    alternatives,
    forbidden,
    caseSensitive,
    wholeWord,
    status: typeof status === "string" ? status : "",
    context,
  };
}

function validateDuplicateEntries(
  entries: readonly ValidatableEntry[],
  problems: GlossaryValidationProblem[],
) {
  const matchingRules = new Map<string, ValidatableEntry>();
  const sourceEntries = new Map<string, ValidatableEntry>();

  for (const entry of entries) {
    if (!entry.source) continue;
    const normalizedSource = entry.source.toLocaleLowerCase();
    const previousSource = sourceEntries.get(normalizedSource);
    if (previousSource && previousSource.context !== entry.context) {
      addProblem(
        problems,
        "warning",
        "duplicate-source-context",
        `entries[${entry.index}].source`,
        {
          entryIndex: entry.index,
          relatedEntryIndex: previousSource.index,
          value: entry.source,
        },
      );
    } else if (!previousSource) {
      sourceEntries.set(normalizedSource, entry);
    }

    const signature = [
      entry.caseSensitive ? "case" : "fold",
      entry.wholeWord ? "word" : "substring",
      comparable(entry.source, entry.caseSensitive),
    ].join("\0");
    const previousMatch = matchingRules.get(signature);
    if (!previousMatch) {
      matchingRules.set(signature, entry);
      continue;
    }

    addProblem(
      problems,
      previousMatch.target !== entry.target ? "error" : "warning",
      previousMatch.target !== entry.target ? "ambiguous-duplicate-entry" : "duplicate-entry",
      `entries[${entry.index}].source`,
      {
        entryIndex: entry.index,
        relatedEntryIndex: previousMatch.index,
        value: entry.source,
      },
    );
  }
}

export function validateGlossaryDocument(input: unknown): GlossaryValidationResult {
  const problems: GlossaryValidationProblem[] = [];
  if (!isRecord(input)) {
    addProblem(problems, "error", "document-not-object", "$");
    return { valid: false, errors: problems, warnings: [], problems };
  }

  if (input.format !== GLOSSARY_FORMAT) {
    addProblem(problems, "error", "unsupported-format", "format");
  }
  if (input.version !== GLOSSARY_FORMAT_VERSION) {
    addProblem(problems, "error", "unsupported-version", "version");
  }
  if (!isGlossaryId(input.id)) addProblem(problems, "error", "invalid-id", "id");
  if (!nonEmptyString(input.name)) addProblem(problems, "error", "name-required", "name");
  if (!isGlossaryLanguageTag(input.sourceLanguage)) {
    addProblem(problems, "error", "invalid-source-language", "sourceLanguage");
  }
  if (!isGlossaryLanguageTag(input.targetLanguage)) {
    addProblem(problems, "error", "invalid-target-language", "targetLanguage");
  }
  if (input.game !== undefined && !nonEmptyString(input.game)) {
    addProblem(problems, "error", "game-empty", "game");
  }
  if (input.updatedAt !== undefined && input.updatedAt !== "" && !isIsoDate(input.updatedAt)) {
    addProblem(problems, "error", "updated-at-invalid", "updatedAt");
  }

  if (input.authors === undefined || (Array.isArray(input.authors) && input.authors.length === 0)) {
    addProblem(problems, "warning", "missing-authors", "authors");
  } else if (!Array.isArray(input.authors)) {
    addProblem(problems, "error", "authors-invalid", "authors");
  } else {
    const authors = new Set<string>();
    input.authors.forEach((author, index) => {
      if (!nonEmptyString(author)) {
        addProblem(problems, "error", "author-empty", `authors[${index}]`);
      } else if (authors.has(author)) {
        addProblem(problems, "error", "duplicate-author", `authors[${index}]`, { value: author });
      } else {
        authors.add(author);
      }
    });
  }

  const validEntries: ValidatableEntry[] = [];
  if (!Array.isArray(input.entries)) {
    addProblem(problems, "error", "entries-invalid", "entries");
  } else {
    if (input.entries.length === 0) addProblem(problems, "warning", "empty-glossary", "entries");
    input.entries.forEach((entry, index) => {
      const validatable = validateEntry(entry, index, problems);
      if (validatable) validEntries.push(validatable);
    });
    validateDuplicateEntries(validEntries, problems);
  }

  const errors = problems.filter((problem) => problem.severity === "error");
  const warnings = problems.filter((problem) => problem.severity === "warning");
  return { valid: errors.length === 0, errors, warnings, problems };
}
