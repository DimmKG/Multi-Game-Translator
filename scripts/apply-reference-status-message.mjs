import { readFile, writeFile } from "node:fs/promises";

const appPath = "src/scripts/app.js";
let app = await readFile(appPath, "utf8");

const oldBlock = `    const sameFilter = document.querySelector('.filt[data-f="same"]');
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
    }`;

const newBlock = `    const sameFilter = document.querySelector('.filt[data-f="same"]');
    if (sameFilter){
      const label = sameFilter.querySelector('[data-i18n="filter.same"]');
      const count = sameFilter.querySelector('.cnt');
      sameFilter.hidden = false;
      sameFilter.disabled = !available;
      sameFilter.classList.toggle("unavailable", !available);
      sameFilter.setAttribute("aria-disabled", available ? "false" : "true");
      sameFilter.title = available ? "" : t("reference.notLoaded");
      if (label) label.textContent = available ? t("filter.same") : t("reference.notLoaded");
      if (!available && count) count.textContent = "—";
    }
    const reviewSame = document.querySelector('.rchip[data-r="same"]');
    if (reviewSame){
      const label = reviewSame.querySelector('[data-i18n="review.sameEng"]');
      const count = reviewSame.querySelector('.n');
      reviewSame.hidden = false;
      reviewSame.disabled = !available;
      reviewSame.classList.toggle("unavailable", !available);
      reviewSame.setAttribute("aria-disabled", available ? "false" : "true");
      reviewSame.title = available ? "" : t("reference.notLoaded");
      if (label) label.textContent = available ? t("review.sameEng") : t("reference.notLoaded");
      if (!available && count) count.textContent = "—";
    }`;

if (!app.includes(oldBlock)) throw new Error("Expected hidden-reference UI block not found");
app = app.replace(oldBlock, newBlock);
await writeFile(appPath, app, "utf8");

const localeValues = {
  en: "No reference file loaded",
  bg: "Не е зареден референтен файл",
  ru: "Референтный файл не загружен"
};
for (const [code, value] of Object.entries(localeValues)) {
  const path = `src/scripts/i18n/locales/${code}.json`;
  const data = JSON.parse(await readFile(path, "utf8"));
  data.messages["reference.notLoaded"] = value;
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

const testPath = "test/reference-dependent-status.test.mjs";
let test = await readFile(testPath, "utf8");
test = test
  .replace('  assert.match(app, /sameFilter\\.hidden = !available/);\n  assert.match(app, /reviewSame\\.hidden = !available/);',
           '  assert.match(app, /sameFilter\\.hidden = false/);\n  assert.match(app, /sameFilter\\.disabled = !available/);\n  assert.match(app, /t\\("reference\\.notLoaded"\\)/);\n  assert.match(app, /reviewSame\\.hidden = false/);\n  assert.match(app, /reviewSame\\.disabled = !available/);')
  .replace('test("same controls only render for matched reference entries", () => {',
           'test("unavailable reference status stays visible but disabled", () => {\n  assert.match(app, /label\\.textContent = available \\? t\\("filter\\.same"\\) : t\\("reference\\.notLoaded"\\)/);\n  assert.match(app, /count\\.textContent = "—"/);\n});\n\ntest("same controls only render for matched reference entries", () => {');
await writeFile(testPath, test, "utf8");

console.log("Changed reference-dependent filters from hidden to visible disabled status.");
