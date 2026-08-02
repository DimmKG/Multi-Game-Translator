// SPDX-License-Identifier: AGPL-3.0-or-later
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildSyntheticEnglishReference,
  buildSyntheticLargeLangFile,
  buildSyntheticTargetTranslation,
} from "../src/core/lang/fixtures/synthetic-lang.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "test/fixtures");

mkdirSync(outDir, { recursive: true });

const files = {
  "synthetic-en.lang": buildSyntheticEnglishReference(),
  "synthetic-target.lang": buildSyntheticTargetTranslation(),
  "synthetic-large.lang": buildSyntheticLargeLangFile(6500),
};

for (const [name, body] of Object.entries(files)) {
  const path = resolve(outDir, name);
  writeFileSync(path, body, "utf8");
  const lines = body.split(/\r\n|\n/).length;
  console.log(`wrote ${name} (${body.length} bytes, ~${lines} lines)`);
}
