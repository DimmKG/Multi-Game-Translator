import { readFile, writeFile } from "node:fs/promises";

const cssPath = "src/styles/app.css";
let css = await readFile(cssPath, "utf8");

const replacements = [
  [
`  header{\n    display:flex;align-items:center;gap:12px 16px;padding:12px 18px;flex-wrap:wrap;\n    background:linear-gradient(180deg,#221c14,#1a1610);\n    border-bottom:1px solid var(--line);flex:0 0 auto;\n  }`,
`  header{\n    display:grid;grid-template-columns:minmax(180px,1fr) auto minmax(220px,340px);\n    align-items:center;gap:10px 16px;padding:12px 18px;\n    background:linear-gradient(180deg,#221c14,#1a1610);\n    border-bottom:1px solid var(--line);flex:0 0 auto;\n  }`
  ],
  [
`  .brand{display:flex;align-items:baseline;gap:10px;user-select:none}`,
`  .brand{display:flex;align-items:baseline;gap:10px;user-select:none;min-width:0}`
  ],
  [
`  .grow{flex:1}`,
`  .grow{display:none}`
  ],
  [
`  select.uilang{background:var(--bg);border:1px solid var(--line);border-radius:8px;color:var(--ink-dim);\n    font-family:var(--sans);font-size:12.5px;padding:6px 9px;outline:none;transition:.12s;\n    flex:0 0 108px;width:108px}`,
`  select.uilang{background:var(--bg);border:1px solid var(--line);border-radius:8px;color:var(--ink-dim);\n    font-family:var(--sans);font-size:12.5px;padding:6px 9px;outline:none;transition:.12s;\n    width:auto;min-width:120px;max-width:min(240px,36vw)}`
  ],
  [
`  .filebar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;flex:0 1 auto}`,
`  .filebar{grid-column:1/-1;display:flex;align-items:stretch;gap:8px;flex-wrap:wrap;justify-content:flex-start;min-width:0;width:100%}`
  ],
  [
`  .btn{\n    border:1px solid var(--line);background:var(--panel-2);color:var(--ink);\n    padding:7px 13px;border-radius:7px;font-size:13px;transition:.15s;white-space:nowrap;\n    text-align:center;overflow:hidden;text-overflow:ellipsis;\n  }`,
`  .btn{\n    border:1px solid var(--line);background:var(--panel-2);color:var(--ink);\n    padding:7px 13px;border-radius:7px;font-size:13px;transition:.15s;\n    text-align:center;white-space:normal;overflow-wrap:anywhere;min-height:36px;\n  }`
  ],
  [
`  /* Fixed widths sized for the longer RU labels so EN/RU switch doesn't reflow the bar */\n  #btnEnRef{width:148px;flex:0 0 148px;padding-left:8px;padding-right:8px}\n  #btnSaveJson,#btnLoadJson{width:158px;flex:0 0 158px;padding-left:8px;padding-right:8px}\n  #btnNew{width:108px;flex:0 0 108px;padding-left:8px;padding-right:8px}\n  #btnExport{width:128px;flex:0 0 128px;padding-left:8px;padding-right:8px}`,
`  #btnEnRef,#btnSaveJson,#btnLoadJson,#btnNew,#btnExport{\n    width:auto;min-width:0;flex:0 1 auto;padding-left:11px;padding-right:11px\n  }`
  ],
  [
`  .fname{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--ink-faint);white-space:nowrap;flex:0 0 auto}\n  .fname input{width:118px;background:var(--bg);border:1px solid var(--line);border-radius:7px;\n    color:var(--ink);font-family:var(--mono);font-size:12.5px;padding:7px 9px;outline:none;transition:.12s}`,
`  .fname{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--ink-faint);white-space:nowrap;flex:1 1 210px;min-width:170px}\n  .fname input{width:auto;min-width:100px;flex:1 1 130px;background:var(--bg);border:1px solid var(--line);border-radius:7px;\n    color:var(--ink);font-family:var(--mono);font-size:12.5px;padding:7px 9px;outline:none;transition:.12s}`
  ],
  [
`  .meter{display:flex;align-items:center;gap:10px;width:240px;flex:0 0 240px;max-width:240px}`,
`  .meter{display:flex;align-items:center;gap:10px;width:100%;min-width:220px;max-width:340px;justify-self:end}`
  ],
  [
`  .savepill{display:flex;align-items:center;gap:8px;padding:6px 11px;border-radius:8px;border:1px solid var(--line);\n    width:198px;flex:0 0 198px;overflow:hidden;`,
`  .savepill{display:flex;align-items:center;gap:8px;padding:6px 11px;border-radius:8px;border:1px solid var(--line);\n    width:auto;min-width:170px;max-width:320px;flex:1 1 220px;overflow:hidden;`
  ],
  [
`  @media (max-width:1100px){ .grow{display:none} }\n  @media (max-width:560px){\n    header{gap:8px 10px;padding:10px 12px}\n    .btn{padding:6px 10px;font-size:12px}\n    .savepill{padding:5px 9px;font-size:11px;width:168px;flex-basis:168px}\n    .fname input{width:90px}\n    .meter{order:5;width:100%;flex:1 1 100%;max-width:none}\n    #btnEnRef,#btnSaveJson,#btnLoadJson,#btnNew,#btnExport{flex:1 1 auto;width:auto}\n  }`,
`  @media (max-width:900px){\n    header{grid-template-columns:minmax(0,1fr) auto}\n    .meter{grid-column:1/-1;justify-self:stretch;max-width:none}\n  }\n  @media (max-width:560px){\n    header{gap:8px 10px;padding:10px 12px}\n    .brand .sub{display:none}\n    select.uilang{min-width:104px;max-width:46vw}\n    .btn{padding:6px 10px;font-size:12px}\n    .savepill{padding:5px 9px;font-size:11px;min-width:150px;max-width:none;flex:1 1 100%}\n    .fname{flex:1 1 100%;min-width:0}\n    .fname input{min-width:0}\n    #btnEnRef,#btnSaveJson,#btnLoadJson,#btnNew,#btnExport{flex:1 1 150px;width:auto}\n  }`
  ]
];

for (const [from, to] of replacements) {
  if (!css.includes(from)) throw new Error(`Expected CSS block not found:\n${from}`);
  css = css.replace(from, to);
}

await writeFile(cssPath, css, "utf8");

const testPath = "test/responsive-header.test.mjs";
await writeFile(testPath, `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\n\nconst css = await readFile(new URL("../src/styles/app.css", import.meta.url), "utf8");\nconst html = await readFile(new URL("../src/index.html", import.meta.url), "utf8");\n\ntest("header uses a two-row capable grid layout", () => {\n  assert.match(css, /header\\{[^}]*display:grid[^}]*grid-template-columns:/s);\n  assert.match(css, /\\.filebar\\{[^}]*grid-column:1\\/-1[^}]*flex-wrap:wrap/s);\n  assert.match(css, /@media \\(max-width:900px\\)/);\n});\n\ntest("localized action labels are not clipped by fixed widths", () => {\n  assert.doesNotMatch(css, /#btnEnRef\\{width:148px/);\n  assert.doesNotMatch(css, /#btnSaveJson,#btnLoadJson\\{width:158px/);\n  assert.match(css, /#btnEnRef,#btnSaveJson,#btnLoadJson,#btnNew,#btnExport\\{[^}]*width:auto/s);\n  assert.match(css, /\\.btn\\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/s);\n});\n\ntest("header keeps all existing controls and file actions", () => {\n  for (const id of ["uiLang", "meter", "savePill", "btnEnRef", "btnSaveJson", "btnLoadJson", "btnNew", "outName", "btnExport"]) {\n    assert.match(html, new RegExp(\`id=["']\${id}["']\`));\n  }\n});\n`, "utf8");

console.log("Applied responsive localized header layout.");
