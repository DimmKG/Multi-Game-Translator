import { readFile, writeFile, unlink } from "node:fs/promises";

const appPath = "src/scripts/app.js";
const uiPath = "src/scripts/new-translation.js";
const testPath = "test/new-translation-from-reference.test.mjs";
const workflowPath = ".github/workflows/validate.yml";

let app = await readFile(appPath, "utf8");
const oldLoader = `  function loadText(text, filename){
    const {eol, items} = parse(text);
    state.eol = eol; state.items = items; state.filename = cleanName(filename);
    state.referenceFilename = "";
    state.mtProvider = preferredProvider();
    state.targetLang = targetFromName(state.filename);
    state.filter = "missing"; state.query = "";
    $("search").value = "";
    setFilter("missing", true);
    openWorkspace();
  }
`;
const newLoader = `  function loadWorkspaceFromText(text, options = {}){
    const config = typeof options === "string" ? {filename: options} : (options || {});
    const {eol, items} = parse(String(text ?? ""));
    state.eol = eol;
    state.items = items;
    state.filename = config.filename ? cleanName(config.filename) : "";
    state.referenceFilename = "";
    if (config.referenceFilename) state.referenceFilename = String(config.referenceFilename);
    state.diffOther = null;
    state.mtProvider = preferredProvider();
    state.targetLang = Object.hasOwn(config, "targetLang")
      ? String(config.targetLang || "")
      : targetFromName(state.filename);
    state.filter = "missing";
    state.query = "";
    $("search").value = "";
    setFilter("missing", true);
    openWorkspace();
  }
  globalThis.NecesseLangTranslator = Object.freeze({loadWorkspaceFromText});
`;
if (!app.includes(oldLoader)) throw new Error("Expected loadText implementation was not found.");
app = app.replace(oldLoader, newLoader);
app = app.replaceAll("loadText(r.result, f.name)", "loadWorkspaceFromText(r.result, {filename: f.name})");

const oldExport = `  $("btnExport").onclick = () => {
    let name = ($("outName").value || "").trim() || state.filename || "ru.lang";
    if (!/\\.lang$/i.test(name)) name += ".lang";
    state.filename = name; $("outName").value = name;
    download(name, buildLang(), "text/plain;charset=utf-8");
    toast(t("toast.exported", {name}));
  };
`;
const newExport = `  $("btnExport").onclick = () => {
    let name = ($("outName").value || "").trim() || state.filename;
    if (!name){
      toast(t("err.targetFilenameRequired"));
      $("outName").focus();
      return;
    }
    if (!/\\.lang$/i.test(name)) name += ".lang";
    state.filename = name; $("outName").value = name;
    download(name, buildLang(), "text/plain;charset=utf-8");
    toast(t("toast.exported", {name}));
  };
`;
if (!app.includes(oldExport)) throw new Error("Expected export implementation was not found.");
app = app.replace(oldExport, newExport);
app = app.replace('const base = (state.filename||"ru.lang").replace(/\\.lang$/i,"");', 'const base = (state.filename || "translation.lang").replace(/\\.lang$/i,"");');
await writeFile(appPath, app, "utf8");

let ui = await readFile(uiPath, "utf8");
const oldSyntheticLoad = `      const generated = new File([result.text], "translation.lang", { type: "text/plain;charset=utf-8" });
      const existingInput = $("fileInput");
      if (typeof existingInput?.onchange !== "function") return;
      existingInput.onchange({ target: { files: [generated], value: "" } });
      setTimeout(() => {
        const outputName = $("outName");
        if (outputName) outputName.value = "";
        const target = $("mtTarget");
        if (target) {
          target.value = "";
          target.dispatchEvent(new Event("input", { bubbles: true }));
          target.dispatchEvent(new Event("change", { bubbles: true }));
        }
        showToast(localeText("toast.newTranslationCreated").replace("{file}", result.referenceFilename).replace("{n}", String(result.entryCount)));
      }, 120);
      input.value = "";
`;
const newDirectLoad = `      const loader = globalThis.NecesseLangTranslator?.loadWorkspaceFromText;
      if (typeof loader !== "function") {
        showToast(localeText("err.generic"));
        input.value = "";
        return;
      }
      loader(result.text, {
        filename: "",
        referenceFilename: result.referenceFilename,
        targetLang: ""
      });
      showToast(localeText("toast.newTranslationCreated").replace("{file}", result.referenceFilename).replace("{n}", String(result.entryCount)));
      input.value = "";
`;
if (!ui.includes(oldSyntheticLoad)) throw new Error("Expected synthetic file loading block was not found.");
ui = ui.replace(oldSyntheticLoad, newDirectLoad);
const exportGuardStart = `  $("btnExport")?.addEventListener("click", event => {`;
const exportGuardEnd = `  }, true);\n\n`;
const guardIndex = ui.indexOf(exportGuardStart);
if (guardIndex >= 0) {
  const guardEnd = ui.indexOf(exportGuardEnd, guardIndex);
  if (guardEnd < 0) throw new Error("Could not locate the end of the old export guard.");
  ui = ui.slice(0, guardIndex) + ui.slice(guardEnd + exportGuardEnd.length);
}
await writeFile(uiPath, ui, "utf8");

let test = await readFile(testPath, "utf8");
const oldFilenameTest = `test("new translation UI requires an explicit target filename", async () => {
  const app = await readFile(new URL("../src/scripts/new-translation.js", import.meta.url), "utf8");
  assert.match(app, /err\\.targetFilenameRequired/);
  assert.match(app, /outputName\\?\\.value\\.trim\\(\\)/);
  assert.doesNotMatch(app, /ru\\.lang/);
});
`;
const newFilenameTest = `test("new translation UI requires an explicit target filename", async () => {
  const app = await readFile(new URL("../src/scripts/app.js", import.meta.url), "utf8");
  assert.match(app, /err\\.targetFilenameRequired/);
  assert.match(app, /\\(\\$\\("outName"\\)\\.value \\|\\| ""\\)\\.trim\\(\\) \\|\\| state\\.filename/);
  assert.match(app, /if \\(!name\\)\\{/);
});
`;
if (!test.includes(oldFilenameTest)) throw new Error("Expected target filename test was not found.");
test = test.replace(oldFilenameTest, newFilenameTest);
if (!test.includes("NecesseLangTranslator")) {
  test += `\n\ntest("new translation uses the shared workspace loader instead of a synthetic file event", async () => {\n  const app = await readFile(new URL("../src/scripts/app.js", import.meta.url), "utf8");\n  const ui = await readFile(new URL("../src/scripts/new-translation.js", import.meta.url), "utf8");\n  assert.match(app, /NecesseLangTranslator = Object\\.freeze\\(\\{loadWorkspaceFromText\\}\\)/);\n  assert.match(ui, /NecesseLangTranslator\\?\\.loadWorkspaceFromText/);\n  assert.doesNotMatch(ui, /new File\\(\\[result\\.text\\]/);\n  assert.doesNotMatch(ui, /existingInput\\.onchange/);\n});\n`;
}
await writeFile(testPath, test, "utf8");

await writeFile(workflowPath, `name: Validate project

on:
  push:
    branches:
      - main
      - "agent/**"
  pull_request:

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest

    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Verify standalone build
        run: npm run verify
`, "utf8");

await unlink(new URL(import.meta.url));
console.log("Direct workspace loader integrated.");
