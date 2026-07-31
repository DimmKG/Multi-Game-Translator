import { inspectTerminology } from "./matcher.js";

const TEXT = {
  en: {
    badge: n => `Terminology: ${n}`,
    title: n => `${n} terminology ${n === 1 ? "issue" : "issues"}`
  },
  ru: {
    badge: n => `Терминология: ${n}`,
    title: n => `Проблем с терминологией: ${n}`
  },
  bg: {
    badge: n => `Терминология: ${n}`,
    title: n => `${n} ${n === 1 ? "терминологичен проблем" : "терминологични проблема"}`
  }
};

const language = () => document.getElementById("uiLang")?.value || "en";
const messages = () => TEXT[language()] || TEXT.en;
const glossaries = () => globalThis.NecesseGlossaries?.getEnabled?.() || [];
const reviewList = () => document.getElementById("reviewlist");
const issuesButton = () => document.querySelector('.rchip[data-r="issues"]');
const allButton = () => document.querySelector('.rchip[data-r="all"]');

let customIssuesMode = false;
let scheduled = false;

function sourceText(row) {
  const source = row.querySelector(".ren");
  return source?.classList.contains("empty-ref") ? "" : source?.textContent || "";
}

function terminologyIssues(row) {
  const textarea = row.querySelector("textarea");
  const source = sourceText(row);
  if (!textarea || !source || !glossaries().length) return [];
  return inspectTerminology(source, textarea.value, glossaries());
}

function annotateRow(row) {
  if (!(row instanceof HTMLElement) || !row.classList.contains("rrow")) return;
  row.querySelector('[data-role="term-review-flag"]')?.remove();

  const issues = terminologyIssues(row);
  row.dataset.termIssues = String(issues.length);
  row.classList.toggle("term-review-flagged", issues.length > 0);
  if (!issues.length) return;

  const badge = document.createElement("span");
  badge.className = "rflag term";
  badge.dataset.role = "term-review-flag";
  badge.textContent = messages().badge(issues.length);
  badge.title = messages().title(issues.length);
  row.querySelector('[data-role="rflags"]')?.append(badge);
}

function isIssue(row) {
  return row.classList.contains("flag") || Number(row.dataset.termIssues || 0) > 0;
}

function updateIssueCount() {
  const rows = [...reviewList()?.querySelectorAll(".rrow") || []];
  if (!rows.length) return;
  const count = rows.filter(isIssue).length;
  const output = document.getElementById("rc-issues");
  if (output) output.textContent = String(count);
}

function applyCustomFilter() {
  if (!customIssuesMode) return;
  for (const row of reviewList()?.querySelectorAll(".rrow") || []) {
    row.hidden = !isIssue(row);
  }
  document.querySelectorAll(".rchip").forEach(button => {
    button.classList.toggle("on", button.dataset.r === "issues");
  });
}

function refresh() {
  scheduled = false;
  const rows = reviewList()?.querySelectorAll(".rrow") || [];
  rows.forEach(annotateRow);
  updateIssueCount();
  applyCustomFilter();
}

function scheduleRefresh() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(refresh);
}

function showCombinedIssues(event) {
  const button = event.target.closest?.('.rchip[data-r="issues"]');
  if (!button) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  customIssuesMode = true;

  // Ask the application to render every touched row first, then apply the
  // combined built-in + terminology filter without duplicating its state.
  allButton()?.click();
  scheduleRefresh();
}

function leaveCustomMode(event) {
  const button = event.target.closest?.(".rchip");
  if (!button || button.dataset.r === "issues") return;
  customIssuesMode = false;
  reviewList()?.querySelectorAll(".rrow[hidden]").forEach(row => { row.hidden = false; });
}

function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `.rflag.term{border-color:color-mix(in srgb,var(--warn,#d9a441) 65%,var(--line,#343944));background:color-mix(in srgb,var(--warn,#d9a441) 12%,transparent)}.rrow.term-review-flagged{box-shadow:inset 3px 0 0 color-mix(in srgb,var(--warn,#d9a441) 75%,transparent)}`;
  document.head.append(style);
}

function start() {
  injectStyles();
  document.addEventListener("click", showCombinedIssues, true);
  document.addEventListener("click", leaveCustomMode, true);
  reviewList()?.addEventListener("input", scheduleRefresh);
  document.getElementById("uiLang")?.addEventListener("change", scheduleRefresh);
  globalThis.NecesseGlossaries?.subscribe?.(() => {
    if (customIssuesMode) allButton()?.click();
    scheduleRefresh();
  });

  const list = reviewList();
  if (list) new MutationObserver(scheduleRefresh).observe(list, { childList: true, subtree: true });
  scheduleRefresh();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
