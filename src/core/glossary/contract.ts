// SPDX-License-Identifier: AGPL-3.0-or-later

export const GLOSSARY_FORMAT = "necesse-glossary" as const;
export const GLOSSARY_FORMAT_VERSION = 1 as const;
export const GLOSSARY_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
export const LANGUAGE_TAG_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
export const GLOSSARY_ENTRY_STATUSES = [
  "approved",
  "draft",
  "deprecated",
  "context-dependent",
] as const;

export type GlossaryEntryStatus = (typeof GLOSSARY_ENTRY_STATUSES)[number];

const entryStatusSet: ReadonlySet<string> = new Set(GLOSSARY_ENTRY_STATUSES);

export function isGlossaryEntryStatus(value: unknown): value is GlossaryEntryStatus {
  return typeof value === "string" && entryStatusSet.has(value);
}

export function isGlossaryLanguageTag(value: unknown): value is string {
  return typeof value === "string" && LANGUAGE_TAG_PATTERN.test(value);
}

export function isGlossaryId(value: unknown): value is string {
  return typeof value === "string" && GLOSSARY_ID_PATTERN.test(value);
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}
