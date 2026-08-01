"use strict";

const navT = (key, vars) => globalThis.NecesseI18n?.t(key, vars) || key;
const navPlural = (base, count, vars) => globalThis.NecesseI18n?.plural(base, count, vars) || String(count);
let terminologyFilterActive = false;
let currentIssueIndex = -1;
let refreshQueued = false;
const navUi = {};

function flaggedCards() {
  return [...document.querySelectorAll("#list .card.term-qa-flagged")];
}

function standardFilters() {
  return [...document.querySelectorAll("#filters .filt:not(.term-nav-filter)")];
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function applyTerminologyVisibility() {
  document.querySelectorAll("#list .card").forEach(card => {
    card.classList.toggle("term-nav-hidden", terminologyFilterActive && !card.classList.contains("term-qa-flagged"));
  });
}

function updateControls() {
  if (!navUi.filter || !navUi.summary) return;
  const cards = flaggedCards();
  const count = cards.length;
  navUi.label.textContent = navT("terminology.filter");
  navUi.filter.title = navT("terminology.filterTitle");
  navUi.filter.classList.toggle("on", terminologyFilterActive);
  navUi.filter.classList.toggle("warn", count > 0);
  navUi.count.textContent = String(count);
  navUi.summary.textContent = navPlural("terminology.count", count);
  navUi.summary.title = navT("terminology.next");
  navUi.summary.disabled = count === 0;
  applyTerminologyVisibility();
}

function queueRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    updateControls();
  });
}

function activateAllEntries() {
  const all = document.querySelector('.filt[data-f="all"]');
  if (all && !all.classList.contains("on")) all.click();
}

function clearStandardFilterSelection() {
  standardFilters().forEach(button => button.classList.remove("on"));
}

function deactivateTerminologyFilter() {
  if (!terminologyFilterActive) return;
  terminologyFilterActive = false;
  currentIssueIndex = -1;
  applyTerminologyVisibility();
  queueRefresh();
}

function toggleTerminologyFilter() {
  const activate = !terminologyFilterActive;
  currentIssueIndex = -1;

  if (activate) {
    activateAllEntries();
    terminologyFilterActive = true;
    clearStandardFilterSelection();
  } else {
    terminologyFilterActive = false;
    activateAllEntries();
  }

  queueRefresh();
}

function focusNextIssue() {
  const cards = flaggedCards().filter(card => !card.classList.contains("term-nav-hidden"));
  if (!cards.length) {
    showToast(navT("terminology.none"));
    return;
  }
  currentIssueIndex = (currentIssueIndex + 1) % cards.length;
  const card = cards[currentIssueIndex];
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.remove("term-nav-pulse");
  void card.offsetWidth;
  card.classList.add("term-nav-pulse");
  card.querySelector("textarea")?.focus({ preventScroll: true });
}

function buildControls() {
  const filters = document.getElementById("filters");
  if (filters) {
    navUi.filter = document.createElement("button");
    navUi.filter.className = "filt term-nav-filter";
    navUi.filter.type = "button";
    const left = document.createElement("span");
    left.className = "l";
    const dot = document.createElement("i");
    dot.className = "dot term-nav-dot";
    navUi.label = document.createElement("span");
    left.append(dot, navUi.label);
    navUi.count = document.createElement("span");
    navUi.count.className = "cnt";
    navUi.filter.append(left, navUi.count);
    navUi.filter.addEventListener("click", toggleTerminologyFilter);
    filters.append(navUi.filter);

    standardFilters().forEach(button => {
      button.addEventListener("click", deactivateTerminologyFilter);
    });
  }

  const toolbar = document.getElementById("toolbar");
  if (toolbar) {
    navUi.summary = document.createElement("button");
    navUi.summary.className = "qbtn term-nav-summary";
    navUi.summary.type = "button";
    navUi.summary.addEventListener("click", focusNextIssue);
    toolbar.insertBefore(navUi.summary, toolbar.querySelector(".qhint"));
  }
}

function injectNavigationStyles() {
  const style = document.createElement("style");
  style.textContent = `.term-nav-dot{background:var(--warn,#d9a441)}.term-nav-hidden{display:none!important}.term-nav-summary:disabled{opacity:.55;cursor:default}.term-nav-summary:not(:disabled){border-color:color-mix(in srgb,var(--warn,#d9a441) 55%,var(--line,#343944))}.term-nav-pulse{animation:term-nav-pulse .7s ease-out}@keyframes term-nav-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--warn,#d9a441) 65%,transparent)}100%{box-shadow:0 0 0 14px transparent}}`;
  document.head.append(style);
}

function startTerminologyNavigation() {
  injectNavigationStyles();
  buildControls();
  document.getElementById("uiLang")?.addEventListener("change", queueRefresh);

  const list = document.getElementById("list");
  if (list) {
    new MutationObserver(queueRefresh).observe(list, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  }
  globalThis.NecesseGlossaries?.subscribe?.(queueRefresh);
  updateControls();
}

function loadMtTargetLanguageControls() {
  if (globalThis.NecesseMtTarget || document.querySelector('script[data-necesse-mt-target]')) return;
  const script = document.createElement("script");
  script.src = "./scripts/mt/target-language.js";
  script.dataset.necesseMtTarget = "true";
  document.head.append(script);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    startTerminologyNavigation();
    loadMtTargetLanguageControls();
  });
} else {
  startTerminologyNavigation();
  loadMtTargetLanguageControls();
}
