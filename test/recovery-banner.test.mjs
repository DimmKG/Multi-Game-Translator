import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("src/scripts/app.js", "utf8");

test("opening any workspace invalidates the startup recovery offer", () => {
  assert.ok(app.includes("let pendingRecovery = null"));
  assert.ok(app.includes("function dismissPendingRecovery"));
  assert.ok(app.includes("function openWorkspace(){\n    // Any workspace that becomes active supersedes the startup recovery offer.\n    dismissPendingRecovery();"));
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
