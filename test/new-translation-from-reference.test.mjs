import test from "node:test";
import assert from "node:assert/strict";
import { createTranslationFromReference } from "../src/scripts/new-translation.js";

const source = [
  "// header",
  "[general]",
  "hello=Hello <name>",
  "SAME_TRANSLATION:unchanged=Keep [item/input=stone]",
  "MISSING_TRANSLATION:old=Old\r\nline",
  "",
  "// footer"
].join("\r\n");

test("new translation preserves structure while marking every entry missing", () => {
  const result = createTranslationFromReference(source, "en.lang");
  assert.equal(result.referenceFilename, "en.lang");
  assert.equal(result.entryCount, 3);
  assert.equal(result.text, [
    "// header",
    "[general]",
    "MISSING_TRANSLATION:hello=Hello <name>",
    "MISSING_TRANSLATION:unchanged=Keep [item/input=stone]",
    "MISSING_TRANSLATION:old=Old\r\nline",
    "",
    "// footer"
  ].join("\r\n"));
});

test("new translation reports an empty reference without inventing entries", () => {
  const result = createTranslationFromReference("// comments only\n[section]", "empty.lang");
  assert.equal(result.entryCount, 0);
  assert.equal(result.text, "// comments only\n[section]");
});

test("new translation UI requires an explicit target filename", async () => {
  const app = await readFile(new URL("../src/scripts/new-translation.js", import.meta.url), "utf8");
  assert.match(app, /err\.targetFilenameRequired/);
  assert.match(app, /outputName\?\.value\.trim\(\)/);
  assert.doesNotMatch(app, /ru\.lang/);
});

import { readFile } from "node:fs/promises";
