import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const write = (p, text) => fs.writeFileSync(path.join(root, p), text);
const replaceOnce = (text, from, to, label) => {
  if (!text.includes(from)) throw new Error(`Missing ${label}`);
  if (text.indexOf(from) !== text.lastIndexOf(from)) throw new Error(`Ambiguous ${label}`);
  return text.replace(from, to);
};

let app = read("src/scripts/app.js");
app = replaceOnce(
  app,
  '    diffOnly: true,    // collapse equal runs\n',
  '    diffOnly: true,    // collapse equal runs\n    diffMode: "word",   // inline Compare granularity: word | character\n',
  "Compare state"
);

const startMarker = "  // ---------- text diff (line-based, like a code editor) ----------";
const endMarker = "  // ---------- section jump list ----------";
const start = app.indexOf(startMarker);
const end = app.indexOf(endMarker);
if (start < 0 || end < 0 || end <= start) throw new Error("Compare renderer block not found");

const replacement = `  // ---------- semantic, token-aware text diff ----------
  function diffEngine(){
    const engine = globalThis.NecesseTokenAwareDiff;
    if (!engine) throw new Error("Token-aware Compare engine is not loaded");
    return engine;
  }

  function diffSegmentsHtml(segments, changedClass){
    if (!segments || !segments.length) return "&nbsp;";
    return segments.map(segment => {
      const text = esc(segment.text);
      return segment.kind === "equal" ? text : \`<span class="\${changedClass}">\${text}</span>\`;
    }).join("") || "&nbsp;";
  }

  function diffPrefixHtml(prefix, changed, cls){
    if (!prefix) return "";
    const html = esc(prefix);
    return changed ? \`<span class="\${cls} diff-prefix">\${html}</span>\` : html;
  }

  function entryDiffHtml(detail){
    const prefixChanged = detail.statusChanged;
    const leftPrefix = diffPrefixHtml(detail.left.prefix, prefixChanged, "di-del");
    const rightPrefix = diffPrefixHtml(detail.right.prefix, prefixChanged, "di-add");
    const leftKey = detail.keyChanged
      ? diffSegmentsHtml(detail.keyInline.left, "di-del")
      : esc(detail.left.key);
    const rightKey = detail.keyChanged
      ? diffSegmentsHtml(detail.keyInline.right, "di-add")
      : esc(detail.right.key);
    const leftValue = detail.valueChanged
      ? diffSegmentsHtml(detail.valueInline.left, "di-del")
      : esc(detail.left.value);
    const rightValue = detail.valueChanged
      ? diffSegmentsHtml(detail.valueInline.right, "di-add")
      : esc(detail.right.value);
    return [leftPrefix + leftKey + "=" + leftValue, rightPrefix + rightKey + "=" + rightValue];
  }

  function inlineDiff(left, right){
    const detail = diffEngine().compareEntryPair(left, right, state.diffMode);
    if (detail.type === "entry") return entryDiffHtml(detail);
    return [
      diffSegmentsHtml(detail.inline.left, "di-del"),
      diffSegmentsHtml(detail.inline.right, "di-add")
    ];
  }

  function syncDiffModeControls(){
    document.querySelectorAll("[data-diff-mode]").forEach(button => {
      const active = button.dataset.diffMode === state.diffMode;
      button.classList.toggle("on", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function renderDiff(){
    AC.hide();
    const box=$("difflist");
    syncDiffModeControls();
    if (!state.diffOther){
      box.innerHTML = \`<div class="empty-d">\${t("diff.empty")}</div>\`;
      $("diffStat").textContent = "";
      return;
    }
    const A=state.diffOther.lines, B=buildLang().split(/\\r\\n|\\n/);
    const engine=diffEngine();
    const semanticRows=engine.diffRows(A,B);
    const summary=engine.summarizeRows(semanticRows,A,B);
    const rows=semanticRows.map(row => ({
      k: row.kind === "equal" ? "eq" : row.kind === "change" ? "chg" : row.kind === "delete" ? "del" : "add",
      li: row.leftIndex,
      ri: row.rightIndex,
      prefixOnly: !!row.prefixOnly
    }));
    $("diffStat").innerHTML =
      \`<span class="del">−\${summary.deleted}</span> · <span class="chg">~\${summary.changed}</span> · <span class="add">+\${summary.added}</span> \${esc(t("diff.stat",{total:rows.length}))}\` +
      \` <span class="diff-detail">· \${esc(t("diff.changedKeys",{n:summary.changedKeys}))} · \${esc(t("diff.changedValues",{n:summary.changedValues}))} · \${esc(t("diff.prefixOnly",{n:summary.prefixOnly}))}</span>\`;

    // Preserve the existing collapse/context behavior.
    let show=rows.map(()=>true);
    if (state.diffOnly){
      const CTX=3;
      show=rows.map(()=>false);
      rows.forEach((row,index)=>{
        if (row.k==="eq") return;
        for (let current=Math.max(0,index-CTX); current<=Math.min(rows.length-1,index+CTX); current++) show[current]=true;
      });
    }

    const cell=text => text==="" ? "&nbsp;" : esc(text);
    const parts=[\`<div class="dhead"><div>\${esc(t("diff.headLine"))}</div><div>\${esc(state.diffOther.name)}</div><div class="h2">\${esc(t("diff.headLine"))}</div><div>\${esc(t("diff.headCurrent"))}</div></div>\`];
    let hidden=0;
    const flushHidden=()=>{ if (hidden){ parts.push(\`<div class="dgap">\${esc(t("diff.gap",{n:hidden}))}</div>\`); hidden=0; } };
    for (let index=0;index<rows.length;index++){
      if (!show[index]){ hidden++; continue; }
      flushHidden();
      const row=rows[index];
      const left=row.li>=0?A[row.li]:"", right=row.ri>=0?B[row.ri]:"";
      let leftHtml, rightHtml;
      if (row.k==="chg") [leftHtml,rightHtml]=inlineDiff(left,right);
      else { leftHtml=row.li>=0?cell(left):""; rightHtml=row.ri>=0?cell(right):""; }
      const classes = row.k + (row.prefixOnly ? " prefix-only" : "");
      parts.push(
        \`<div class="drow \${classes}">\`+
        \`<div class="dnum dnum-l">\${row.li>=0?row.li+1:""}</div>\`+
        \`<div class="dtxt txt-l">\${leftHtml}</div>\`+
        \`<div class="dnum dnum-r side2">\${row.ri>=0?row.ri+1:""}</div>\`+
        \`<div class="dtxt txt-r">\${rightHtml}</div>\`+
        \`</div>\`);
    }
    flushHidden();
    if (state.diffOnly && !summary.added && !summary.deleted && !summary.changed)
      parts.push(\`<div class="empty-d">\${esc(t("diff.identical"))}</div>\`);
    box.innerHTML = parts.join("");
    box.scrollTop = 0;
  }

`;
app = app.slice(0, start) + replacement + app.slice(end);

app = replaceOnce(
  app,
  '  $("diffOnlyToggle").addEventListener("click", () => {\n    state.diffOnly = !state.diffOnly;\n    $("diffOnlyToggle").classList.toggle("on", state.diffOnly);\n    renderDiff();\n  });\n',
  '  $("diffOnlyToggle").addEventListener("click", () => {\n    state.diffOnly = !state.diffOnly;\n    $("diffOnlyToggle").classList.toggle("on", state.diffOnly);\n    renderDiff();\n  });\n  $("diffInlineMode").addEventListener("click", event => {\n    const button = event.target.closest("[data-diff-mode]");\n    if (!button) return;\n    state.diffMode = button.dataset.diffMode === "character" ? "character" : "word";\n    syncDiffModeControls();\n    renderDiff();\n  });\n',
  "Compare event wiring"
);
write("src/scripts/app.js", app);

let index = read("src/index.html");
index = replaceOnce(
  index,
  '      <label class="toggle on" id="diffOnlyToggle" data-i18n-title="diff.onlyDiffTitle">\n        <span class="tk"></span><span data-i18n="diff.onlyDiff"></span>\n      </label>\n',
  '      <label class="toggle on" id="diffOnlyToggle" data-i18n-title="diff.onlyDiffTitle">\n        <span class="tk"></span><span data-i18n="diff.onlyDiff"></span>\n      </label>\n      <div class="diff-mode" id="diffInlineMode" role="group" data-i18n-aria-label="diff.inlineMode">\n        <button type="button" class="diff-mode-btn on" data-diff-mode="word" data-i18n="diff.modeWords" aria-pressed="true"></button>\n        <button type="button" class="diff-mode-btn" data-diff-mode="character" data-i18n="diff.modeCharacters" aria-pressed="false"></button>\n      </div>\n',
  "Compare mode controls"
);
index = replaceOnce(
  index,
  '<script src="./scripts/app.js"></script>\n',
  '<script src="./scripts/compare/token-aware-diff.js"></script>\n<script src="./scripts/app.js"></script>\n',
  "Compare engine script"
);
write("src/index.html", index);

for (const [code, messages] of Object.entries({
  en: {
    "diff.inlineMode": "Inline difference detail",
    "diff.modeWords": "Words",
    "diff.modeCharacters": "Characters",
    "diff.changedKeys": "Keys: {n}",
    "diff.changedValues": "Values: {n}",
    "diff.prefixOnly": "Status only: {n}"
  },
  bg: {
    "diff.inlineMode": "Подробност на разликите в реда",
    "diff.modeWords": "Думи",
    "diff.modeCharacters": "Знаци",
    "diff.changedKeys": "Ключове: {n}",
    "diff.changedValues": "Стойности: {n}",
    "diff.prefixOnly": "Само статус: {n}"
  },
  ru: {
    "diff.inlineMode": "Детализация различий в строке",
    "diff.modeWords": "Слова",
    "diff.modeCharacters": "Символы",
    "diff.changedKeys": "Ключи: {n}",
    "diff.changedValues": "Значения: {n}",
    "diff.prefixOnly": "Только статус: {n}"
  }
})) {
  const localePath = `src/scripts/i18n/locales/${code}.json`;
  const locale = JSON.parse(read(localePath));
  Object.assign(locale.messages, messages);
  write(localePath, JSON.stringify(locale, null, 2) + "\n");
}

let css = read("src/styles/app.css");
if (!css.includes("/* Token-aware Compare controls */")) {
  css += `

/* Token-aware Compare controls */
.diff-mode{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:8px;overflow:hidden;flex:0 0 auto}
.diff-mode-btn{border:0;border-inline-end:1px solid var(--line);background:transparent;color:var(--ink-muted);padding:6px 10px;font:inherit;cursor:pointer}
.diff-mode-btn:last-child{border-inline-end:0}
.diff-mode-btn:hover{background:var(--surface-2);color:var(--ink)}
.diff-mode-btn.on{background:var(--accent-soft);color:var(--accent);font-weight:700}
.diff-mode-btn:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.diffstat .diff-detail{color:var(--ink-muted);font-weight:500;white-space:nowrap}
.drow.prefix-only .dtxt{background-image:linear-gradient(90deg,transparent,rgba(245,158,11,.08),transparent)}
.diff-prefix{font-weight:750}
@media (max-width:760px){
  .diffbar{overflow-x:auto;flex-wrap:nowrap}
  .diffstat .diff-detail{display:none}
}
`;
}
write("src/styles/app.css", css);

const integrationTest = `import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("src/scripts/app.js", "utf8");
const html = fs.readFileSync("src/index.html", "utf8");
const css = fs.readFileSync("src/styles/app.css", "utf8");

const locale = code => JSON.parse(fs.readFileSync(\`src/scripts/i18n/locales/\${code}.json\`, "utf8"));

test("Compare loads the token-aware engine before the application", () => {
  const engine = html.indexOf("./scripts/compare/token-aware-diff.js");
  const application = html.indexOf("./scripts/app.js");
  assert.ok(engine >= 0);
  assert.ok(application > engine);
});

test("Compare exposes localized word and character inline modes", () => {
  assert.match(html, /id="diffInlineMode"/);
  assert.match(html, /data-diff-mode="word"/);
  assert.match(html, /data-diff-mode="character"/);
  assert.match(app, /state\.diffMode = button\.dataset\.diffMode/);
  assert.match(app, /compareEntryPair\(left, right, state\.diffMode\)/);
});

test("Compare summary separates keys, values, and status-only changes", () => {
  assert.match(app, /summary\.changedKeys/);
  assert.match(app, /summary\.changedValues/);
  assert.match(app, /summary\.prefixOnly/);
});

test("reviewed locales include the Compare mode and summary messages", () => {
  for (const code of ["en", "bg", "ru"]) {
    const messages = locale(code).messages;
    for (const key of ["diff.inlineMode", "diff.modeWords", "diff.modeCharacters", "diff.changedKeys", "diff.changedValues", "diff.prefixOnly"]) {
      assert.equal(typeof messages[key], "string", \`\${code} missing \${key}\`);
      assert.ok(messages[key].length > 0);
    }
  }
});

test("Compare controls remain responsive and keyboard-visible", () => {
  assert.match(css, /\.diff-mode-btn:focus-visible/);
  assert.match(css, /@media \(max-width:760px\)/);
});
`;
write("test/token-aware-diff-integration.test.mjs", integrationTest);

console.log("Integrated token-aware Compare renderer and controls.");
