import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/scripts/glossary/manager.js", import.meta.url), "utf8");

test("legacy glossary sources are normalized", () => {
  assert.match(source, /source === "catalog"/);
  assert.match(source, /sourceInfo\(item\.source\)/);
});

test("catalog versions are compared through updatedAt", () => {
  assert.match(source, /entry\.updatedAt/);
  assert.match(source, /versionOf\(record\.glossary\)/);
  assert.match(source, /compareVersions/);
});

test("catalog glossary records retain their update URL", () => {
  assert.match(source, /\{ type: "catalog", url: entry\.url \}/);
  assert.match(source, /record\.source\.url|source\.url/);
});

test("update controls are shown only for newer catalog versions", () => {
  assert.match(source, /updateAvailable\(record\)/);
  assert.match(source, /gm-update-available/);
  assert.match(source, /updateRecord/);
});
