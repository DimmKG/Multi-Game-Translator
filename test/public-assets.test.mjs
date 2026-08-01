import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const read = path => readFile(resolve(root, path), "utf8");

test("the initial document language is English and changes with the interface", async () => {
  const [html, app] = await Promise.all([
    read("src/index.html"),
    read("src/scripts/app.js")
  ]);

  assert.match(html, /<html lang="en">/);
  assert.match(app, /document\.documentElement\.lang\s*=\s*UI/);
});

test("the browser glossary catalog and every referenced glossary are public", async () => {
  const catalogPath = resolve(root, "src/glossaries/catalog.json");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));

  assert.equal(catalog.format, "necesse-glossary-catalog");
  assert.ok(catalog.glossaries.length > 0);

  for (const entry of catalog.glossaries) {
    assert.ok(!/^https?:/i.test(entry.url), "The bundled catalog should use local URLs.");
    const filePath = resolve(root, "src/glossaries", entry.url);
    await access(filePath);
    const glossary = JSON.parse(await readFile(filePath, "utf8"));
    assert.equal(glossary.id, entry.id);
  }
});
