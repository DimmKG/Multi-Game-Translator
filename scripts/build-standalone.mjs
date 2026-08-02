// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "dist-standalone");
const sourceHtmlPath = path.join(outputDir, "index.html");
const finalHtmlPath = path.join(outputDir, "necesse-lang-translator.html");

function localAssetPath(url) {
  const normalized = url.replace(/^\.\//, "");
  if (normalized.startsWith("/") || normalized.includes(":") || normalized.startsWith("#")) {
    throw new Error(`Standalone build contains a non-local asset reference: ${url}`);
  }
  return path.join(outputDir, normalized);
}

let html = await readFile(sourceHtmlPath, "utf8");

const stylesheetPattern = /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/g;
const scriptPattern = /<script\s+[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*><\/script>/g;

const stylesheetMatches = [...html.matchAll(stylesheetPattern)];
const scriptMatches = [...html.matchAll(scriptPattern)];

if (stylesheetMatches.length !== 1) {
  throw new Error(`Expected exactly one generated stylesheet, found ${stylesheetMatches.length}.`);
}
if (scriptMatches.length !== 1) {
  throw new Error(`Expected exactly one generated module script, found ${scriptMatches.length}.`);
}

for (const match of stylesheetMatches) {
  const css = await readFile(localAssetPath(match[1]), "utf8");
  html = html.replace(match[0], `<style>\n${css}\n</style>`);
}

for (const match of scriptMatches) {
  const javascript = await readFile(localAssetPath(match[1]), "utf8");
  html = html.replace(match[0], `<script type="module">\n${javascript}\n</script>`);
}

// Only inspect actual HTML tags for unresolved local references. Bundled JavaScript can
// legitimately contain strings such as "./assets/..." that are not fetched by the browser.
const htmlWithoutInlinePayloads = html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "<script></script>")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "<style></style>");
const remainingLocalReferences = [
  ...htmlWithoutInlinePayloads.matchAll(
    /(?:src|href)=["'](?!data:|blob:|https?:|mailto:|tel:|#)([^"']+)["']/gi,
  ),
].map((match) => match[1]);
if (remainingLocalReferences.length > 0) {
  throw new Error(
    `Standalone HTML still contains local file references: ${remainingLocalReferences.join(", ")}`,
  );
}

await writeFile(finalHtmlPath, html, "utf8");

for (const entry of await readdir(outputDir)) {
  if (entry === path.basename(finalHtmlPath)) continue;
  await rm(path.join(outputDir, entry), { recursive: true, force: true });
}

const finalSize = Buffer.byteLength(html);
console.log(`Standalone build created: ${path.relative(root, finalHtmlPath)} (${finalSize} bytes)`);
