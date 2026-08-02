import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const built = await readFile(resolve("dist/necesse-lang-translator.html"), "utf8");
const failures = [];

const requireText = (text, label) => {
  if (!built.includes(text)) failures.push(`Missing ${label}.`);
};

requireText("<!DOCTYPE html>", "HTML document declaration");
requireText("<style>", "embedded application styles");
requireText("NecesseLocales.register", "embedded generated interface locales");
requireText("GENERATED FILE — DO NOT EDIT", "generated locale bundle marker");
requireText("necesse-translator.interface-locales.v1", "interface locale package storage");
requireText("function normalizeInterfaceLocale", "interface locale package validator");
requireText("restoreInstalledInterfaceLocales", "interface locale startup restoration");
requireText("const GLOSSARY_FORMAT", "embedded glossary loader");
requireText("globalThis.NecesseGlossaries", "embedded Glossary Manager API");
requireText("necesse-translator.glossaries.v1", "Glossary Manager storage key");
requireText("function inspectTerminology", "embedded terminology matcher");
requireText("term-qa-flagged", "embedded terminology QA interface");
requireText("term-review-flag", "embedded Review terminology integration");
requireText("showCombinedIssues", "embedded combined Review issue filter");
requireText("term-nav-filter", "embedded terminology navigation controls");
requireText("focusNextIssue", "embedded terminology issue navigation");
requireText("globalThis.NecesseTokenAwareDiff", "embedded token-aware Compare engine");
requireText("compareEntryPair", "embedded Compare entry analysis");

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
