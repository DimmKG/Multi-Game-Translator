import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("public assets", () => {
  it("the initial document language is English", async () => {
    const html = await readFile(resolve(root, "index.html"), "utf8");
    const i18n = await readFile(resolve(root, "src/features/i18n/I18nProvider.tsx"), "utf8");
    expect(html).toMatch(/<html lang="en"/);
    expect(i18n).toMatch(/document\.documentElement\.lang\s*=\s*language/);
  });

  it("the browser glossary catalog and every referenced glossary are public", async () => {
    const catalogPath = resolve(root, "public/glossaries/catalog.json");
    const catalog = JSON.parse(await readFile(catalogPath, "utf8"));

    expect(catalog.format).toBe("necesse-glossary-catalog");
    expect(catalog.glossaries.length).toBeGreaterThan(0);

    for (const entry of catalog.glossaries) {
      expect(/^https?:/i.test(entry.url)).toBe(false);
      const filePath = resolve(root, "public/glossaries", entry.url);
      await access(filePath);
      const glossary = JSON.parse(await readFile(filePath, "utf8"));
      expect(glossary.id).toBe(entry.id);
    }
  });
});
