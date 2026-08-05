// SPDX-License-Identifier: AGPL-3.0-or-later
import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { isGlossaryId, isGlossaryLanguageTag } from "./contract";
import { validateGlossaryDocument } from "./validation";

const glossaryRoot = resolve("glossaries");

async function collectJson(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectJson(path)));
    else if (extname(entry.name) === ".json") files.push(path);
  }
  return files;
}

function validateCatalog(data: unknown, file: string): string[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return [`${file}: catalog must be an object`];
  }

  const catalog = data as Record<string, unknown>;
  const errors: string[] = [];
  if (catalog.version !== 1) errors.push(`${file}: unsupported catalog version`);
  if (!Array.isArray(catalog.glossaries)) {
    errors.push(`${file}: glossaries must be an array`);
    return errors;
  }

  const ids = new Set<string>();
  catalog.glossaries.forEach((value, index) => {
    const where = `${file}: glossaries[${index}]`;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`${where} must be an object`);
      return;
    }
    const item = value as Record<string, unknown>;
    if (!isGlossaryId(item.id)) errors.push(`${where}.id is invalid`);
    else if (ids.has(item.id)) errors.push(`${where}.id is duplicated`);
    else ids.add(item.id);
    if (!isGlossaryLanguageTag(item.sourceLanguage)) {
      errors.push(`${where}.sourceLanguage is invalid`);
    }
    if (!isGlossaryLanguageTag(item.targetLanguage)) {
      errors.push(`${where}.targetLanguage is invalid`);
    }
    if (typeof item.url !== "string" || !item.url) errors.push(`${where}.url is required`);
  });
  return errors;
}

describe("repository glossary files", () => {
  it("conform to the shared glossary contract", async () => {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const path of await collectJson(glossaryRoot)) {
      const file = path.slice(resolve(".").length + 1).replaceAll("\\", "/");
      let data: unknown;
      try {
        data = JSON.parse(await readFile(path, "utf8"));
      } catch (error) {
        errors.push(`${file}: invalid JSON (${error instanceof Error ? error.message : error})`);
        continue;
      }

      if (
        data &&
        typeof data === "object" &&
        !Array.isArray(data) &&
        (data as Record<string, unknown>).format === "necesse-glossary-catalog"
      ) {
        errors.push(...validateCatalog(data, file));
        continue;
      }

      const result = validateGlossaryDocument(data);
      errors.push(...result.errors.map((problem) => `${file}: ${problem.path} (${problem.code})`));
      warnings.push(
        ...result.warnings.map((problem) => `${file}: ${problem.path} (${problem.code})`),
      );
    }

    if (warnings.length > 0) console.warn(`Glossary validation warnings:\n${warnings.join("\n")}`);
    expect(errors).toEqual([]);
  });
});
