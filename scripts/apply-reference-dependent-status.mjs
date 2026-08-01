import { readFile, writeFile } from "node:fs/promises";

const appPath = "src/scripts/app.js";
let app = await readFile(appPath, "utf8");

function replaceOnce(from, to, label) {
  if (!app.includes(from)) throw new Error(`Missing ${label}`);
  app = app.replace(from, to);
}

replaceOnce(
`  function statusOf(e){
    if (e.markedSame) return "same";
    if (e.wasMissing){`,
`  function statusOf(e){
    // SAME_TRANSLATION is a file-format marker, but it is only a verifiable UI
    // status when this entry has a value from a loaded reference file.
    if (e.markedSame && e.ref != null) return "same";
    if (e.wasMissing){`,
"reference-aware statusOf"
);

replaceOnce(
`  function applyReference(map){
    let matched = 0;
    for (const e of state.items){
      if (e.type !== "entry") continue;
      const r = map.get(e.key);`,
`  function applyReference(map){
    let matched = 0;
    for (const e of state.items){
      if (e.type !== "entry") continue;
      // Loading a different reference must not retain matches from the old one.
      delete e.ref;
      const r = map.get(e.key);`,
"reference replacement cleanup"
);

replaceOnce(
`  // ---------- counts + progress ----------
  function counts(){`,
`  function hasUsableReference(){
    return !!state.referenceFilename && state.items.some(e => e.type === "entry" && e.ref != null);
  }
  function syncReferenceDependentUi(){
    const available = hasUsableReference();
    const sameFilter = document.querySelector('.filt[data-f="same"]');
    if (sameFilter){
      sameFilter.hidden = !available;
      sameFilter.disabled = !available;
      sameFilter.setAttribute("aria-hidden", available ? "false" : "true");
    }
    const reviewSame = document.querySelector('.rchip[data-r="same"]');
    if (reviewSame){
      reviewSame.hidden = !available;
      reviewSame.disabled = !available;
      reviewSame.setAttribute("aria-hidden", available ? "false" : "true");
    }
    if (!available && state.filter === "same"){
      state.filter = "missing";
      document.querySelectorAll(".filt").forEach(x => x.classList.toggle("on", x.dataset.f === "missing"));
    }
    if (!available && state.reviewFilter === "same"){
      state.reviewFilter = "all";
      document.querySelectorAll(".rchip").forEach(x => x.classList.toggle("on", x.dataset.r === "all"));
    }
    return available;
  }

  // ---------- counts + progress ----------
  function counts(){`,
"reference UI synchronization"
);

replaceOnce(
`  function refreshMeter(){
    const c = counts();`,
`  function refreshMeter(){
    syncReferenceDependentUi();
    const c = counts();`,
"refreshMeter synchronization"
);

replaceOnce(
`    const sameEng = (s==="done" && e.value.trim()!=="" && e.value === (enRef != null ? enRef : e.english));`,
`    const sameEng = (e.ref != null && s==="done" && e.value.trim()!=="" && e.value === enRef);`,
"review same-reference calculation"
);

const sameBlock = /    \/\/ same-as-english toggle\n    const sb = document\.createElement\("button"\);[\s\S]*?    r3\.appendChild\(sb\);/;
if (!sameBlock.test(app)) throw new Error("Missing same toggle block");
app = app.replace(sameBlock,
`    // SAME_TRANSLATION controls are meaningful only for entries matched to a
    // loaded reference file. The underlying marker is still preserved in state.
    if (e.ref != null){
      const sb = document.createElement("button");
      sb.className = "samebtn" + (e.markedSame ? " on" : "");
      sb.textContent = e.markedSame ? t("same.on") : t("same.off");
      sb.title = t("same.title");
      sb.onclick = () => {
        e.markedSame = !e.markedSame; e.touched = true;
        if (e.markedSame && e.value.trim()===""){ e.value = e.ref; ta.value = e.ref; autosize(ta); syncWs(ta); }
        updateCard(card, e); refreshMeter(); scheduleSave();
      };
      r3.appendChild(sb);
    }`
);

replaceOnce(
`    state.eol = eol; state.items = items; state.filename = cleanName(filename);`,
`    state.eol = eol; state.items = items; state.filename = cleanName(filename);
    state.referenceFilename = "";`,
"new workspace reference reset"
);

replaceOnce(
`      const s = statusOf(it);
      if (s === "missing") out.push(MISS + it.key + "=" + it.value);
      else if (s === "same") out.push(SAME + it.key + "=" + it.value);
      else out.push(it.key + "=" + it.value);`,
`      const s = statusOf(it);
      // Preserve an explicit SAME_TRANSLATION file marker even when no external
      // reference is loaded; reference availability only gates the UI status.
      if (it.markedSame) out.push(SAME + it.key + "=" + it.value);
      else if (s === "missing") out.push(MISS + it.key + "=" + it.value);
      else out.push(it.key + "=" + it.value);`,
"lossless SAME_TRANSLATION export"
);

await writeFile(appPath, app, "utf8");

const testLines = [
'import test from "node:test";',
'import assert from "node:assert/strict";',
'import { readFile } from "node:fs/promises";',
'',
'const app = await readFile(new URL("../src/scripts/app.js", import.meta.url), "utf8");',
'const html = await readFile(new URL("../src/index.html", import.meta.url), "utf8");',
'',
'test("same status requires a matched loaded reference", () => {',
'  assert.match(app, /e\\.markedSame && e\\.ref != null/);',
'  assert.match(app, /function hasUsableReference\\(\\)/);',
'  assert.match(app, /sameFilter\\.hidden = !available/);',
'  assert.match(app, /reviewSame\\.hidden = !available/);',
'});',
'',
'test("same controls only render for matched reference entries", () => {',
'  assert.match(app, /if \\(e\\.ref != null\\)\\{[\\s\\S]*className = "samebtn"/);',
'  assert.match(app, /const sameEng = \\(e\\.ref != null/);',
'});',
'',
'test("new targets and replacement references clear stale reference state", () => {',
'  assert.match(app, /state\\.referenceFilename = "";/);',
'  assert.match(app, /delete e\\.ref;[\\s\\S]*const r = map\\.get\\(e\\.key\\)/);',
'});',
'',
'test("explicit SAME_TRANSLATION markers remain lossless on export", () => {',
'  assert.match(app, /if \\(it\\.markedSame\\) out\\.push\\(SAME/);',
'});',
'',
'test("reference-dependent filter controls remain present in the document", () => {',
'  assert.match(html, /data-f="same"/);',
'  assert.match(html, /data-r="same"/);',
'});',
''
];
await writeFile("test/reference-dependent-status.test.mjs", testLines.join("\n"), "utf8");
console.log("Applied reference-dependent status behavior.");
