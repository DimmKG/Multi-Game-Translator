"use strict";

const GLOSSARY_FEEDBACK_TEXT = {
  en: {
    enable: "Enable",
    disable: "Disable",
    enabled: name => `Glossary “${name}” is enabled.`,
    disabled: name => `Glossary “${name}” is disabled.`
  },
  ru: {
    enable: "Включить",
    disable: "Выключить",
    enabled: name => `Глоссарий «${name}» включён.`,
    disabled: name => `Глоссарий «${name}» выключен.`
  },
  bg: {
    enable: "Включи",
    disable: "Изключи",
    enabled: name => `Речникът „${name}“ е включен.`,
    disabled: name => `Речникът „${name}“ е изключен.`
  }
};

const currentLanguage = () => document.getElementById("uiLang")?.value || "en";
const feedbackText = () => GLOSSARY_FEEDBACK_TEXT[currentLanguage()] || GLOSSARY_FEEDBACK_TEXT.en;

function updateToggleLabels(root = document) {
  const text = feedbackText();
  root.querySelectorAll?.(".gm-toggle").forEach(button => {
    const enabled = button.classList.contains("on");
    button.textContent = enabled ? text.disable : text.enable;
    button.setAttribute("aria-pressed", enabled ? "true" : "false");
    button.title = enabled ? text.disable : text.enable;
  });
}

let toastTimer = 0;
function showGlossaryToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2400);
}

function handleToggleClick(event) {
  const button = event.target.closest?.(".gm-toggle");
  if (!button) return;
  const card = button.closest(".gm-card");
  const name = card?.querySelector(".gm-info strong")?.textContent?.trim() || "";
  const willBeEnabled = !button.classList.contains("on");
  const text = feedbackText();
  queueMicrotask(() => {
    updateToggleLabels();
    showGlossaryToast(willBeEnabled ? text.enabled(name) : text.disabled(name));
  });
}

const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) updateToggleLabels(node);
    }
  }
});

function startGlossaryFeedback() {
  updateToggleLabels();
  document.addEventListener("click", handleToggleClick, true);
  document.getElementById("uiLang")?.addEventListener("change", () => updateToggleLabels());
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startGlossaryFeedback);
else startGlossaryFeedback();
