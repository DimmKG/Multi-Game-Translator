import fs from "node:fs";

const appPath = "src/scripts/app.js";
let app = fs.readFileSync(appPath, "utf8");

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing ${label}`);
  if (text.indexOf(from) !== text.lastIndexOf(from)) throw new Error(`Ambiguous ${label}`);
  return text.replace(from, to);
}

app = replaceOnce(
  app,
  "  // ---------- UI wiring ----------\n  function openWorkspace(){\n",
  "  // ---------- UI wiring ----------\n  let pendingRecovery = null;\n  function dismissPendingRecovery({discardStored = false} = {}){\n    pendingRecovery = null;\n    const banner = $(\"restore\");\n    if (banner) banner.style.display = \"none\";\n    if (discardStored){\n      try{ localStorage.removeItem(LS_KEY); }catch(e){}\n    }\n  }\n\n  function openWorkspace(){\n    // Any workspace that becomes active supersedes the startup recovery offer.\n    dismissPendingRecovery();\n",
  "workspace recovery dismissal"
);

const oldRestore = `  // restore banner
  function tryRestore(){
    let data; try{ data = JSON.parse(localStorage.getItem(LS_KEY)); }catch(e){ data=null; }
    if (!data || !(data.i || data.items)) return;
    $("restore").style.display = "flex";
    $("restoreName").textContent = data.f || data.filename || "ru.lang";
    const d = new Date(data.s || data.savedAt || Date.now());
    $("restoreWhen").textContent = d.toLocaleString("ru-RU");
    $("restoreYes").onclick = () => {
      try { deserialize(data); $("restore").style.display="none"; setFilter("missing",true); openWorkspace(); }
      catch(err){ toast(t("err.restoreFailed")); }
    };
    $("restoreNo").onclick = () => { localStorage.removeItem(LS_KEY); $("restore").style.display="none"; };
  }
`;

const newRestore = `  // restore banner
  function tryRestore(){
    let data; try{ data = JSON.parse(localStorage.getItem(LS_KEY)); }catch(e){ data=null; }
    if (!data || !(data.i || data.items)) return;
    pendingRecovery = data;
    $("restore").style.display = "flex";
    $("restoreName").textContent = data.f || data.filename || "translation.lang";
    const d = new Date(data.s || data.savedAt || Date.now());
    $("restoreWhen").textContent = d.toLocaleString(UI);
    $("restoreYes").onclick = () => {
      const recovery = pendingRecovery;
      if (!recovery) return;
      try { deserialize(recovery); setFilter("missing",true); openWorkspace(); }
      catch(err){ toast(t("err.restoreFailed")); }
    };
    $("restoreNo").onclick = () => dismissPendingRecovery({discardStored:true});
  }
`;
app = replaceOnce(app, oldRestore, newRestore, "restore banner implementation");
fs.writeFileSync(appPath, app);

const test = `import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("src/scripts/app.js", "utf8");

test("opening any workspace invalidates the startup recovery offer", () => {
  assert.ok(app.includes("let pendingRecovery = null"));
  assert.ok(app.includes("function dismissPendingRecovery"));
  assert.match(app, /function openWorkspace\(\)\{\s*\/\/ Any workspace[\s\S]*?dismissPendingRecovery\(\);/);
});

test("Continue cannot restore a recovery offer after it was dismissed", () => {
  assert.ok(app.includes("const recovery = pendingRecovery"));
  assert.ok(app.includes("if (!recovery) return"));
  assert.ok(app.includes("deserialize(recovery)"));
});

test("Start over discards the stored recovery session", () => {
  assert.ok(app.includes("dismissPendingRecovery({discardStored:true})"));
  assert.ok(app.includes("localStorage.removeItem(LS_KEY)"));
});

test("recovery metadata has neutral filename and locale fallbacks", () => {
  assert.ok(app.includes('data.f || data.filename || "translation.lang"'));
  assert.ok(app.includes("toLocaleString(UI)"));
  assert.ok(!app.includes('data.f || data.filename || "ru.lang"'));
  assert.ok(!app.includes('toLocaleString("ru-RU")'));
});
`;
fs.writeFileSync("test/recovery-banner.test.mjs", test);
console.log("Applied stale recovery banner fix.");
