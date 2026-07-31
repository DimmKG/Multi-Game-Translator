import { inspectTerminology } from "./matcher.js";

const t = (key, vars) => globalThis.NecesseI18n?.t(key, vars) || key;
const plural = (base, count, vars) => globalThis.NecesseI18n?.plural(base, count, vars) || String(count);
const enabledGlossaries = () => globalThis.NecesseGlossaries?.getEnabled?.() || [];

function sourceText(card) {
  const original = card.querySelector(".orig");
  if (!original) return "";
  const clone = original.cloneNode(true);
  clone.querySelector(".olabel")?.remove();
  return clone.textContent || "";
}

function issueNode(issue) {
  const row = document.createElement("div");
  row.className = `term-qa-row ${issue.type}`;

  const icon = document.createElement("span");
  icon.className = "term-qa-icon";
  icon.textContent = issue.type === "forbidden" ? "⛔" : "⚠";

  const body = document.createElement("div");
  body.className = "term-qa-body";
  const message = document.createElement("div");
  message.textContent = issue.type === "forbidden"
    ? t("terminology.forbidden", issue)
    : t("terminology.missing", issue);
  body.append(message);

  const details = [issue.glossaryName ? t("terminology.glossary", { name: issue.glossaryName }) : "", issue.context, issue.note].filter(Boolean);
  if (details.length) {
    const meta = document.createElement("small");
    meta.textContent = details.join(" · ");
    body.append(meta);
  }

  row.append(icon, body);
  return row;
}

function scanCard(card) {
  if (!(card instanceof HTMLElement) || !card.classList.contains("card")) return;
  const textarea = card.querySelector("textarea.tr, textarea");
  const source = sourceText(card);
  const previous = card.querySelector(":scope > .term-qa");
  previous?.remove();

  if (!textarea || !source || !enabledGlossaries().length) {
    card.classList.remove("term-qa-flagged");
    return;
  }

  const issues = inspectTerminology(source, textarea.value, enabledGlossaries());
  card.classList.toggle("term-qa-flagged", issues.length > 0);
  if (!issues.length) return;

  const box = document.createElement("section");
  box.className = "term-qa";
  const heading = document.createElement("div");
  heading.className = "term-qa-heading";
  heading.innerHTML = `<strong>${t("terminology.title")}</strong><span>${plural("terminology.count", issues.length)}</span>`;
  box.append(heading, ...issues.map(issueNode));

  const textareaWrap = textarea.closest(".tawrap");
  (textareaWrap || textarea).insertAdjacentElement("afterend", box);
}

function scanAll() {
  document.querySelectorAll("#list .card").forEach(scanCard);
}

function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `.card.term-qa-flagged{border-color:color-mix(in srgb,var(--warn,#d9a441) 60%,var(--line,#343944))}.term-qa{margin:9px 0 0;border:1px solid color-mix(in srgb,var(--warn,#d9a441) 55%,transparent);border-radius:8px;background:color-mix(in srgb,var(--warn,#d9a441) 8%,transparent);overflow:hidden}.term-qa-heading{display:flex;justify-content:space-between;gap:12px;padding:7px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid color-mix(in srgb,var(--warn,#d9a441) 30%,transparent)}.term-qa-heading span{color:var(--muted,#9aa3b2);text-transform:none;letter-spacing:0}.term-qa-row{display:flex;gap:8px;padding:8px 10px;font-size:12px}.term-qa-row+.term-qa-row{border-top:1px solid color-mix(in srgb,var(--warn,#d9a441) 20%,transparent)}.term-qa-row.forbidden{background:color-mix(in srgb,#d65a5a 7%,transparent)}.term-qa-icon{flex:0 0 auto}.term-qa-body{display:grid;gap:3px}.term-qa-body small{color:var(--muted,#9aa3b2);line-height:1.35}`;
  document.head.append(style);
}

function start() {
  injectStyles();
  document.addEventListener("input", event => {
    const card = event.target.closest?.("#list .card");
    if (card) scanCard(card);
  });
  document.getElementById("uiLang")?.addEventListener("change", scanAll);
  globalThis.NecesseGlossaries?.subscribe?.(scanAll);

  const list = document.getElementById("list");
  if (list) {
    new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.classList.contains("card")) scanCard(node);
          node.querySelectorAll?.(".card").forEach(scanCard);
        }
      }
    }).observe(list, { childList: true, subtree: true });
  }
  scanAll();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
