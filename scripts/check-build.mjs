import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const built = await readFile(resolve("dist/necesse-lang-translator.html"), "utf8");
const failures = [];

const requireText = (text, label) => {
  if (!built.includes(text)) failures.push(`Missing ${label}.`);
};

requireText("<!DOCTYPE html>", "HTML document declaration");
requireText("<style>", "embedded application styles");
requireText("const I18N = {", "embedded interface locales");
requireText("const GLOSSARY_FORMAT", "embedded glossary loader");
requireText("globalThis.NecesseGlossaries", "embedded Glossary Manager API");
requireText("necesse-translator.glossaries.v1", "Glossary Manager storage key");
requireText("function inspectTerminology", "embedded terminology matcher");
requireText("term-qa-flagged", "embedded terminology QA interface");
requireText("term-nav-filter", "embedded terminology navigation controls");
requireText("focusNextIssue", "embedded terminology issue navigation");

if (/<link[^>]+href=["']\.\//i.test(built)) failures.push("Standalone build still references a local stylesheet.");
if (/<script[^>]+src=["']\.\//i.test(built)) failures.push("Standalone build still references a local script.");
if (/^\s*import\s/m.test(built)) failures.push("Standalone build contains an unresolved JavaScript import.");
if (/^\s*export\s/m.test(built)) failures.push("Standalone build contains an unresolved JavaScript export.");

if (failures.length) {
  console.error("Standalone integrity checks failed:\n" + failures.map(item => `- ${item}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Standalone build is self-contained and includes the required application modules.");
}
