import { readFile, writeFile } from "node:fs/promises";

const sourcePath = "src/scripts/settings-tabs.js";
let source = await readFile(sourcePath, "utf8");
const before = ".settings-tablist{display:flex;gap:4px;overflow-x:auto;flex:0 0 auto;";
const after = ".settings-tablist{display:flex;gap:4px;overflow-x:auto;overflow-y:hidden;flex:0 0 auto;";
if (!source.includes(before)) throw new Error("Expected Settings tablist CSS was not found.");
source = source.replace(before, after);
await writeFile(sourcePath, source, "utf8");

const testPath = "test/settings-tabs.test.mjs";
let test = await readFile(testPath, "utf8");
if (!test.includes("tab strip hides accidental vertical overflow")) {
  test += `\n\ntest("tab strip hides accidental vertical overflow", () => {\n  assert.match(source, /overflow-x:auto;overflow-y:hidden/);\n});\n`;
}
await writeFile(testPath, test, "utf8");

console.log("Applied Settings tab strip overflow polish.");
