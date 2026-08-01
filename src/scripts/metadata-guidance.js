const GUIDANCE_RULES = Object.freeze([
  Object.freeze({ key: "localname", messageKey: "metadata.localname" }),
  Object.freeze({ key: "engname", messageKey: "metadata.engname" }),
  Object.freeze({ key: "extrasymbols", messageKey: "metadata.extrasymbols" }),
  Object.freeze({ section: "lang", key: "credits", messageKey: "metadata.langCredits" })
]);

function normalizePart(value) {
  return String(value || "").trim().replace(/^\[|\]$/g, "").toLowerCase();
}

export function metadataGuidanceFor(entry) {
  const key = normalizePart(entry?.key);
  const section = normalizePart(entry?.section);
  return GUIDANCE_RULES.find(rule => {
    if (normalizePart(rule.key) !== key) return false;
    return rule.section == null || normalizePart(rule.section) === section;
  }) || null;
}

export function metadataGuidanceRules() {
  return GUIDANCE_RULES;
}

function currentLocaleText(key) {
  const code = document.getElementById("uiLang")?.value || "en";
  return globalThis.I18N?.[code]?.[key] ?? globalThis.I18N?.en?.[key] ?? key;
}

function ensureStyle() {
  if (document.getElementById("metadataGuidanceStyle")) return;
  const style = document.createElement("style");
  style.id = "metadataGuidanceStyle";
  style.textContent = ".metadata-guidance{margin:8px 0 10px;padding:8px 10px;border-left:3px solid var(--accent);border-radius:4px;background:color-mix(in srgb,var(--accent) 8%,transparent);color:var(--ink-dim);font-size:12px;line-height:1.45}";
  document.head.appendChild(style);
}

function renderMetadataGuidance() {
  const list = document.getElementById("list");
  if (!list) return;
  ensureStyle();
  let section = "";
  for (const node of list.children) {
    if (node.classList?.contains("sec-head")) {
      section = node.textContent || "";
      continue;
    }
    if (!node.classList?.contains("card")) continue;
    const rule = metadataGuidanceFor({ section, key: node.dataset.key });
    let hint = node.querySelector(":scope > .metadata-guidance");
    if (!rule) {
      hint?.remove();
      continue;
    }
    if (!hint) {
      hint = document.createElement("div");
      hint.className = "metadata-guidance";
      const row = node.querySelector(":scope > .row1");
      row?.insertAdjacentElement("afterend", hint);
    }
    hint.textContent = "ⓘ " + currentLocaleText(rule.messageKey);
  }
}

function setupMetadataGuidance() {
  const list = document.getElementById("list");
  if (!list) return;
  const observer = new MutationObserver(renderMetadataGuidance);
  observer.observe(list, { childList: true });
  document.getElementById("uiLang")?.addEventListener("change", () => setTimeout(renderMetadataGuidance, 0));
  renderMetadataGuidance();
}

globalThis.NecesseMetadataGuidance = Object.freeze({
  metadataGuidanceFor,
  metadataGuidanceRules,
  render: renderMetadataGuidance
});

if (typeof document !== "undefined") setupMetadataGuidance();
