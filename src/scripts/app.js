
"use strict";

/* Interface locale data is loaded from ./i18n/locales.js. */
(function(){
  const LS_KEY = "necesse_lang_translator_v1";
  const MISS = "MISSING_TRANSLATION:";
  const SAME = "SAME_TRANSLATION:";
  const TOKEN_RE = /<[^>]+>|\[[^\]]+\]|§(?:#[0-9a-fA-F]{6}|[0-9A-Za-z])|\\n/g;

  const $ = id => document.getElementById(id);

  // ---------- i18n ----------
  const LANG_KEY = "necesse_lang_translator_ui_lang";
  function detectLang(){
    try{
      const saved = localStorage.getItem(LANG_KEY);
      if (saved && I18N[saved]) return saved;
    }catch(e){}
    const nav = (navigator.language || "en").toLowerCase();
    if (nav.startsWith("bg")) return "bg"; // Добавяме проверка за български
    if (nav.startsWith("ru")) return "ru";
    return "en";
  }
  let UI = detectLang();
  function t(key, vars){
    let s = (I18N[UI] && I18N[UI][key]);
    if (s == null) s = (I18N.en[key] != null ? I18N.en[key] : key);
    if (vars) for (const k in vars) s = s.split("{"+k+"}").join(String(vars[k]));
    return s;
  }
  function applyI18n(root){
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    scope.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    scope.querySelectorAll("[data-i18n-title]").forEach(el => { el.title = t(el.dataset.i18nTitle); });
    scope.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    scope.querySelectorAll("[data-i18n-aria-label]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel)); });
    document.documentElement.lang = UI;
    document.title = t("app.title");
  }
  function setUiLang(code){
    if (!I18N[code]) return;
    UI = code;
    try{ localStorage.setItem(LANG_KEY, code); }catch(e){}
    $("uiLang").value = code;
    applyI18n();
    if (state.items.length){
      updateReferenceBtn(); refreshMeter(); renderSectionJumps();
      $("diffName").textContent = state.diffOther ? t("diff.fileInfo", {name: state.diffOther.name, n: state.diffOther.lines.length}) : "";
      setView(state.view);
    }
  }

  // Strip download-duplication artifacts ("ru_1_.lang", "ru (1).lang") without
  // touching real locale codes like pt-BR, zh-CN or es-419.
  function cleanName(name){
    let base = String(name || "").replace(/\.lang$/i, "");
    base = base.replace(/\s*\(\d+\)\s*$/, "");   // "ru (1)" -> "ru"
    base = base.replace(/_\d+_?/g, "");           // "ru_1_" / "ru_1" -> "ru"  (locales never use "_")
    base = base.replace(/^_+|_+$/g, "");
    return base ? base + ".lang" : "translation.lang";
  }

  const state = {
    filename: "",
    eol: "\r\n",
    items: [],          // parsed lines in order
    filter: "missing",
    query: "",
    saveTimer: null,
    // machine-translation / spellcheck
    spellcheck: true,
    mtProvider: "google",
    targetLang: "",
    byId: new Map(),
    savedAt: 0,
    view: "editor",
    reviewFilter: "all",
    reviewQuery: "",
    acEnabled: true,
    referenceFilename: "",
    diffOther: null,   // {name, lines[]}
    diffOnly: true,    // collapse equal runs
    diffMode: "word",   // inline Compare granularity: word | character
  };

  // ---------- parsing ----------
  function classifyLine(line){
    const t = line.trim();
    if (t === "") return {type:"blank", raw:line};
    if (t.startsWith("//")) return {type:"comment", raw:line};
    if (/^\[.*\]$/.test(t)) return {type:"section", raw:line, name:t};
    return {type:"comment", raw:line};   // passthrough for anything without "="
  }
  function parse(text){
    const eol = text.includes("\r\n") ? "\r\n" : "\n";
    const lines = text.split(/\r\n|\n/);
    const items = lines.map((line, idx) => {
      const t = line.trim();
      if (t === "" || t.startsWith("//") || /^\[.*\]$/.test(t)) return classifyLine(line);
      let pfx = "none", body = line;
      if (line.startsWith(MISS)) { pfx="missing"; body=line.slice(MISS.length); }
      else if (line.startsWith(SAME)) { pfx="same"; body=line.slice(SAME.length); }
      const eq = body.indexOf("=");
      if (eq < 0) return classifyLine(line);
      const key = body.slice(0, eq);
      const english = body.slice(eq+1);       // inline source value for missing entries
      // working value: prefill missing entries with their inline source so tokens are preserved
      return {
        type:"entry", id:idx, key, english,
        value: english,                        // current translation text
        markedSame: pfx === "same",
        wasMissing: pfx === "missing",
        touched: false,                        // user changed it in this workspace
      };
    });
    return {eol, items};
  }

  // derived status: "missing" | "done" | "same"
  function statusOf(e){
    // SAME_TRANSLATION is a file-format marker, but it is only a verifiable UI
    // status when this entry has a value from a loaded reference file.
    if (e.markedSame && e.ref != null) return "same";
    if (e.wasMissing){
      if (e.value.trim() === "" || e.value === e.english) return "missing";
      return "done";
    }
    // originally translated line
    if (e.value.trim() === "") return "missing";
    return "done";
  }

  function tokensOf(str){
    const m = str.match(TOKEN_RE);
    return m ? m : [];
  }
  function tokClass(tok){
    if (tok.startsWith("<")) return "var";
    if (tok.startsWith("[")) return "ref";
    if (tok.startsWith("§")) return "fmt";
    return "nl"; // \n
  }
  // tokens present in english but missing from translation (multiset-aware)
  function missingTokens(e){
    const src = tokensOf(sourceText(e));
    if (!src.length) return [];
    const have = tokensOf(e.value);
    const pool = have.slice();
    const miss = [];
    for (const tk of src){
      const i = pool.indexOf(tk);
      if (i === -1) miss.push(tk); else pool.splice(i,1);
    }
    // unique preserve order
    return [...new Set(miss)];
  }

  const esc = s => s.replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));

  // ---------- whitespace anomalies ----------
  const RE_LEAD = /^[ \t\u00A0]+/, RE_TRAIL = /[ \t\u00A0]+$/, RE_DBL = / {2,}/;
  const RE_WS_ANY = /^[ \t\u00A0]|[ \t\u00A0]$|[\t\u00A0]| {2}/;
  // runs to highlight: leading, trailing, any tab/nbsp, inner double spaces
  const RE_WS_RUN = /^[ \t\u00A0]+|[ \t\u00A0]+$|[\t\u00A0]+| {2,}/g;
  function wsGlyphs(s){
    return s.replace(/ /g,"·").replace(/\t/g,"⇥").replace(/\u00A0/g,"⍽");
  }
  function wsMark(s){ return s ? `<span class="ws">${wsGlyphs(s)}</span>` : ""; }
  // escape + make runs of 2+ spaces visible
  function escWS(s){
    return esc(s).replace(/ {2,}/g, m => `<span class="ws">${"·".repeat(m.length)}</span>`)
                 .replace(/\t/g, `<span class="ws">⇥</span>`)
                 .replace(/\u00A0/g, `<span class="ws">⍽</span>`);
  }
  // Overlay markup for a textarea: keeps the ORIGINAL characters (so widths line up
  // with the textarea on top) and only paints backgrounds behind whitespace runs.
  function wsOverlayHTML(v){
    let out = "", last = 0, m;
    RE_WS_RUN.lastIndex = 0;
    while ((m = RE_WS_RUN.exec(v)) !== null){
      if (m[0] === ""){ RE_WS_RUN.lastIndex++; continue; }
      out += esc(v.slice(last, m.index));
      out += `<span class="wsb">${esc(m[0])}</span>`;
      last = m.index + m[0].length;
    }
    out += esc(v.slice(last));
    return out + "\n";   // trailing newline keeps the last line's height stable
  }
  // Flags whitespace in the translation that the English source doesn't have.
  function wsScan(e){
    const v = e.value, en = referenceSource(e);
    const lead  = RE_LEAD.test(v)  && !(en != null && RE_LEAD.test(en));
    const trail = RE_TRAIL.test(v) && !(en != null && RE_TRAIL.test(en));
    const core  = v.replace(RE_LEAD,"").replace(RE_TRAIL,"");
    const enCore = en != null ? en.replace(RE_LEAD,"").replace(RE_TRAIL,"") : null;
    const dbl   = RE_DBL.test(core) && !(enCore != null && RE_DBL.test(enCore));
    const tab   = v.includes("\t") && !(en != null && en.includes("\t"));
    const nbsp  = v.includes("\u00A0") && !(en != null && en.includes("\u00A0"));
    return {lead, trail, dbl, tab, nbsp, any: lead||trail||dbl||tab||nbsp};
  }
  function wsLabel(w){
    const p = [];
    if (w.lead)  p.push(t("ws.lead"));
    if (w.trail) p.push(t("ws.trail"));
    if (w.dbl)   p.push(t("ws.dbl"));
    if (w.tab)   p.push(t("ws.tab"));
    if (w.nbsp)  p.push(t("ws.nbsp"));
    return p.join(", ");
  }
  // normalize: strip stray edges, collapse doubles, keep the English source's own edges
  function wsFix(e){
    const en = referenceSource(e);
    let v = e.value.replace(/\t/g," ").replace(/\u00A0/g," ")
                   .replace(RE_LEAD,"").replace(RE_TRAIL,"")
                   .replace(/ {2,}/g," ");
    if (en != null){
      v = ((en.match(RE_LEAD)||[""])[0]) + v + ((en.match(RE_TRAIL)||[""])[0]);
    }
    return v;
  }
  function wsCount(){
    let n = 0;
    for (const e of state.items) if (e.type==="entry" && wsScan(e).any) n++;
    return n;
  }
  function highlight(str){
    const lead = (str.match(RE_LEAD)||[""])[0];
    const trail = lead.length === str.length ? "" : (str.match(RE_TRAIL)||[""])[0];
    const body = str.slice(lead.length, str.length - trail.length);
    let out = "", last = 0, m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(body)) !== null){
      out += escWS(body.slice(last, m.index));
      const tk = m[0];
      out += `<span class="t-${tokClass(tk)}">${esc(tk)}</span>`;
      last = m.index + tk.length;
    }
    out += escWS(body.slice(last));
    return wsMark(lead) + out + wsMark(trail);
  }

  // Source text for an entry: the loaded reference value when available, otherwise
  // the inline value carried by a MISSING_TRANSLATION entry. null when unavailable.
  function referenceSource(e){ return (e.ref != null) ? e.ref : (e.wasMissing ? e.english : null); }
  function sourceText(e){ const s = referenceSource(e); return s != null ? s : e.english; }

  function parseReferenceLang(text){
    const map = new Map();
    for (const raw of text.split(/\r\n|\n/)){
      const t = raw.trim();
      if (t==="" || t.startsWith("//") || /^\[.*\]$/.test(t)) continue;
      let body = raw;
      if (body.startsWith(MISS)) body = body.slice(MISS.length);
      else if (body.startsWith(SAME)) body = body.slice(SAME.length);
      const eq = body.indexOf("="); if (eq < 0) continue;
      map.set(body.slice(0, eq), body.slice(eq+1));
    }
    return map;
  }
  function applyReference(map){
    let matched = 0;
    for (const e of state.items){
      if (e.type !== "entry") continue;
      // Loading a different reference must not retain matches from the old one.
      delete e.ref;
      const r = map.get(e.key);
      if (r != null){ e.ref = r; matched++; }
    }
    return matched;
  }
  function updateReferenceBtn(){
    const b = $("btnEnRef"); if (!b) return;
    if (state.referenceFilename){
      const n = state.items.filter(e => e.type==="entry" && e.ref != null).length;
      b.textContent = t("btn.enRefLoaded", {file: state.referenceFilename, n});
      b.classList.add("okbtn");
      b.title = t("btn.enRefLoadedTitle", {file: state.referenceFilename, n});
    } else {
      b.textContent = t("btn.enRef");
      b.title = t("btn.enRefTitle");
      b.classList.remove("okbtn");
    }
  }

  function hasUsableReference(){
    return !!state.referenceFilename && state.items.some(e => e.type === "entry" && e.ref != null);
  }
  function syncReferenceDependentUi(){
    const available = hasUsableReference();
    const sameFilter = document.querySelector('.filt[data-f="same"]');
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
    }
    if (!available && state.filter === "same"){
      state.filter = "missing";
      document.querySelectorAll(".filt").forEach(x => x.classList.toggle("on", x.dataset.f === "missing"));
    }
    if (!available && state.reviewFilter === "same"){
      state.reviewFilter = "all";
      document.querySelectorAll(".rchip").forEach(x => x.classList.toggle("on", x.dataset.r === "all"));
    }
    return available;
  }

  // ---------- counts + progress ----------
  function counts(){
    let missing=0, done=0, same=0, total=0, missBase=0, missDone=0, touched=0;
    for (const it of state.items){
      if (it.type !== "entry") continue;
      total++;
      if (it.touched) touched++;
      const s = statusOf(it);
      if (s==="missing") missing++; else if (s==="same") same++; else done++;
      if (it.wasMissing){ missBase++; if (s!=="missing") missDone++; }
    }
    return {missing, done, same, total, missBase, missDone, touched};
  }
  function refreshMeter(){
    syncReferenceDependentUi();
    const c = counts();
    $("c-missing").textContent = c.missing;
    $("c-done").textContent = c.done;
    $("c-same").textContent = c.same;
    $("c-all").textContent = c.total;
    const ws = wsCount();
    $("c-ws").textContent = ws;
    const wsBtn = document.querySelector('.filt[data-f="ws"]');
    if (wsBtn) wsBtn.classList.toggle("warn", ws > 0);
    const pct = c.missBase ? Math.round(c.missDone / c.missBase * 100) : 100;
    $("fill").style.width = pct + "%";
    $("pct").innerHTML = `<b>${c.missDone}</b> / ${c.missBase} &nbsp;(${pct}%)`;
    $("footnote").innerHTML =
      esc(t("footnote.main", {file: state.filename, total: c.total, missing: c.missing})) +
      (c.same ? esc(t("footnote.same", {n: c.same})) : "") +
      (ws ? `<span style="color:var(--warn)">${esc(t("footnote.ws", {n: ws}))}</span>` : "");
    const trc = $("tabReviewCount"); if (trc) trc.textContent = c.touched;
    if (state.view === "review") updateReviewCounts();
  }

  // ---------- render list ----------
  function matchFilter(e){
    const s = statusOf(e);
    if (state.filter === "all") { /* pass */ }
    else if (state.filter === "ws") { if (!wsScan(e).any) return false; }
    else if (state.filter === "missing" && s !== "missing") return false;
    else if (state.filter === "done" && s !== "done") return false;
    else if (state.filter === "same" && s !== "same") return false;
    if (state.query){
      const q = state.query.toLowerCase();
      if (!e.key.toLowerCase().includes(q) &&
          !e.english.toLowerCase().includes(q) &&
          !e.value.toLowerCase().includes(q)) return false;
    }
    return true;
  }

  function renderList(){
    AC.hide();
    const list = $("list");
    list.innerHTML = "";
    let curSection = null, shown = 0, frag = document.createDocumentFragment();

    // walk items in order, inserting section headers before their entries
    let pendingSection = null;
    for (const it of state.items){
      if (it.type === "section"){ pendingSection = it.name; continue; }
      if (it.type !== "entry") continue;
      if (!matchFilter(it)) continue;
      if (pendingSection && pendingSection !== curSection){
        const h = document.createElement("div");
        h.className = "sec-head";
        h.textContent = pendingSection.replace(/^\[|\]$/g,"");
        frag.appendChild(h);
        curSection = pendingSection;
      } else if (pendingSection === null && curSection === null){
        // entries before any section
      }
      pendingSection = curSection; // keep header sticky until next section
      frag.appendChild(buildCard(it));
      shown++;
    }

    if (shown === 0){
      const d = document.createElement("div");
      d.style.cssText = "text-align:center;color:var(--ink-faint);padding:60px 20px;font-size:14px";
      d.textContent = state.query ? t("empty.noMatch") :
        (state.filter === "missing" ? t("empty.allDone") :
         state.filter === "ws" ? t("empty.noWs") : t("empty.generic"));
      frag.appendChild(d);
    }
    list.appendChild(frag);
    list.scrollTop = 0;
  }

  function buildCard(e){
    const card = document.createElement("div");
    const s = statusOf(e);
    card.className = "card st-" + s;
    card.dataset.key = e.key;
    card.dataset.idx = e.id;

    // row1
    const r1 = document.createElement("div"); r1.className = "row1";
    const key = document.createElement("button");
    key.className = "key"; key.textContent = e.key; key.title = t("card.copyKey");
    key.onclick = () => { navigator.clipboard?.writeText(e.key); toast(t("toast.keyCopied")); };
    const badge = document.createElement("span");
    badge.className = "badge " + (s==="missing"?"b-missing":s==="same"?"b-same":"b-done");
    badge.textContent = s==="missing"?t("badge.missing"):s==="same"?t("badge.same"):t("badge.done");
    const mtBadge = document.createElement("span");
    mtBadge.className = "badge b-mt" + (e.mtDraft && s==="done" ? " on" : "");
    mtBadge.textContent = t("badge.mt");
    r1.appendChild(key); r1.appendChild(badge); r1.appendChild(mtBadge);
    r1.appendChild(Object.assign(document.createElement("div"),{className:"spacer"}));
    card.appendChild(r1);

    // original (English reference from en.lang, or inline English for missing entries)
    const en = referenceSource(e);
    if (en != null){
      const orig = document.createElement("div"); orig.className = "orig";
      orig.innerHTML = `<span class="olabel">${esc(t("card.referenceText"))}</span>${highlight(en)}`;
      card.appendChild(orig);
    }

    // textarea + whitespace overlay
    const {wrap, ta} = makeTextarea(false);
    ta.className = "tr"; ta.value = e.value; ta.rows = 1;
    ta.spellcheck = state.spellcheck; ta.lang = state.targetLang || "ru";
    autosize(ta); syncWs(ta);
    ta.addEventListener("input", () => {
      e.value = ta.value; e.mtDraft = false; e.touched = true; autosize(ta); syncWs(ta);
      updateCard(card, e); refreshMeter(); scheduleSave();
    });
    ta.addEventListener("keydown", ev => {
      if ((ev.ctrlKey||ev.metaKey) && ev.key === "Enter"){
        ev.preventDefault(); focusNextMissing(card);
      }
    });
    card.appendChild(wrap);

    // row3: tokens + same toggle + warnings
    const r3 = document.createElement("div"); r3.className = "row3";
    r3.dataset.role = "tokens";
    card.appendChild(r3);
    renderTokens(r3, e, ta, card);

    return card;
  }

  function renderTokens(r3, e, ta, card){
    r3.innerHTML = "";
    const toks = [...new Set(tokensOf(sourceText(e)))];
    const miss = new Set(missingTokens(e));
    if (toks.length){
      const lead = document.createElement("span"); lead.className="toklead"; lead.textContent=t("tokens.label");
      r3.appendChild(lead);
      for (const tk of toks){
        const c = document.createElement("button");
        const cls = tokClass(tk);
        c.className = "chip " + cls + (miss.has(tk) ? " miss" : "");
        c.textContent = tk;
        c.title = miss.has(tk) ? t("tokens.insertMissing") : t("tokens.insert");
        c.onclick = () => { insertAtCursor(ta, tk); e.value = ta.value; e.touched = true; autosize(ta); updateCard(card,e); refreshMeter(); scheduleSave(); };
        r3.appendChild(c);
      }
    }
    // machine-translation button
    const mt = document.createElement("button");
    mt.className = "mtbtn";
    mt.innerHTML = `<span class="sp2"></span>${esc(t("mt.btn"))}`;
    mt.title = t("mt.btnTitle");
    mt.onclick = () => translateEntry(e, ta, card, mt);
    r3.appendChild(mt);
    // whitespace warning + one-click fix
    const w = wsScan(e);
    if (w.any){
      const fix = document.createElement("button");
      fix.className = "chip wsfix";
      fix.textContent = "⚠ " + wsLabel(w);
      fix.title = t("ws.fixTitle");
      fix.onclick = () => {
        e.value = wsFix(e); e.touched = true; ta.value = e.value; autosize(ta); syncWs(ta);
        updateCard(card, e); refreshMeter(); scheduleSave(); toast(t("toast.wsFixed"));
      };
      r3.appendChild(fix);
    }
    // SAME_TRANSLATION controls are meaningful only for entries matched to a
    // loaded reference file. The underlying marker is still preserved in state.
    if (e.ref != null){
      const sb = document.createElement("button");
      sb.className = "samebtn" + (e.markedSame ? " on" : "");
      sb.textContent = e.markedSame ? t("same.on") : t("same.off");
      sb.title = t("same.title");
      sb.onclick = () => {
        e.markedSame = !e.markedSame; e.touched = true;
        if (e.markedSame && e.value.trim()===""){ e.value = e.ref; ta.value = e.ref; autosize(ta); syncWs(ta); }
        updateCard(card, e); refreshMeter(); scheduleSave();
      };
      r3.appendChild(sb);
    }
  }

  function updateCard(card, e){
    const s = statusOf(e);
    card.className = "card st-" + s;
    const badge = card.querySelector(".badge:not(.b-mt)");
    if (badge){
      badge.className = "badge " + (s==="missing"?"b-missing":s==="same"?"b-same":"b-done");
      badge.textContent = s==="missing"?t("badge.missing"):s==="same"?t("badge.same"):t("badge.done");
    }
    const mtBadge = card.querySelector(".b-mt");
    if (mtBadge) mtBadge.classList.toggle("on", !!e.mtDraft && s==="done");
    const r3 = card.querySelector('[data-role="tokens"]');
    const ta = card.querySelector("textarea");
    if (r3 && ta) renderTokens(r3, e, ta, card);
  }

  function focusNextMissing(fromCard){
    let n = fromCard.nextElementSibling;
    while (n && !(n.classList && n.classList.contains("card") && n.classList.contains("st-missing"))) n = n.nextElementSibling;
    if (n){ const ta = n.querySelector("textarea"); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); n.scrollIntoView({block:"center"}); }
    else toast(t("toast.noMoreMissing"));
  }

  function insertAtCursor(ta, text){
    const s = ta.selectionStart ?? ta.value.length, en = ta.selectionEnd ?? ta.value.length;
    ta.value = ta.value.slice(0,s) + text + ta.value.slice(en);
    ta.focus(); const p = s + text.length; ta.setSelectionRange(p,p);
    syncWs(ta);
  }
  function autosize(ta){ ta.style.height="auto"; ta.style.height = Math.min(ta.scrollHeight, 260) + "px"; }

  // Wrap a textarea so whitespace can be painted behind it, and keep them in sync.
  function makeTextarea(review){
    const wrap = document.createElement("div");
    wrap.className = "tawrap" + (review ? " rv" : "");
    const ta = document.createElement("textarea");
    wrap.appendChild(ta);
    ta.addEventListener("scroll", () => {
      const b = wrap.querySelector(".wsback");
      if (b) b.scrollTop = ta.scrollTop;
    });
    return {wrap, ta};
  }
  function syncWs(ta){
    const wrap = ta.parentNode;
    if (!wrap || !wrap.classList || !wrap.classList.contains("tawrap")) return;
    let back = wrap.querySelector(".wsback");
    if (!RE_WS_ANY.test(ta.value)){ if (back) back.remove(); return; }
    if (!back){
      back = document.createElement("div");
      back.className = "wsback";
      back.setAttribute("aria-hidden","true");
      wrap.insertBefore(back, ta);
    }
    back.innerHTML = wsOverlayHTML(ta.value);
    back.scrollTop = ta.scrollTop;
  }

  // ---------- review view ----------
  function extraTokens(e){
    const src = tokensOf(sourceText(e)), have = tokensOf(e.value);
    const pool = src.slice(), extra = [];
    for (const tk of have){ const i = pool.indexOf(tk); if (i===-1) extra.push(tk); else pool.splice(i,1); }
    return [...new Set(extra)];
  }
  function computeReview(e){
    const s = statusOf(e);
    const miss = missingTokens(e);
    const extra = extraTokens(e);
    const enRef = referenceSource(e);
    const sameEng = (e.ref != null && s==="done" && e.value.trim()!=="" && e.value === enRef);
    const empty = (s==="missing");            // touched but not actually translated (cleared / MT echoed english)
    const mt = !!e.mtDraft && s==="done";
    const ws = wsScan(e);
    const flagged = miss.length>0 || extra.length>0 || sameEng || empty || ws.any;
    return {s, miss, extra, sameEng, empty, mt, ws, flagged};
  }
  function reviewMatch(e){
    if (!e.touched) return false;             // only strings changed in this workspace
    const c = computeReview(e);
    if (state.reviewFilter==="mt" && !c.mt) return false;
    if (state.reviewFilter==="issues" && !c.flagged) return false;
    if (state.reviewFilter==="same" && !c.sameEng) return false;
    if (state.reviewQuery){
      const q = state.reviewQuery.toLowerCase();
      if (!e.key.toLowerCase().includes(q) && !e.english.toLowerCase().includes(q) && !e.value.toLowerCase().includes(q)) return false;
    }
    return true;
  }
  function reviewStats(){
    let all=0, mt=0, issues=0, same=0;
    for (const e of state.items){
      if (e.type!=="entry" || !e.touched) continue;
      all++;
      const c = computeReview(e);
      if (c.mt) mt++;
      if (c.flagged) issues++;
      if (c.sameEng) same++;
    }
    return {all, mt, issues, same};
  }
  function updateReviewCounts(){
    const st = reviewStats();
    $("rc-all").textContent = st.all; $("rc-mt").textContent = st.mt;
    $("rc-issues").textContent = st.issues; $("rc-same").textContent = st.same;
  }

  function flagNodes(c){
    const nodes = [];
    if (c.empty){ const b=document.createElement("span"); b.className="rflag miss"; b.textContent=t("rflag.notTranslated"); nodes.push(b); }
    if (c.mt){ const b=document.createElement("span"); b.className="rflag mt"; b.textContent=t("badge.mt"); nodes.push(b); }
    if (c.miss.length){ const b=document.createElement("span"); b.className="rflag miss"; b.textContent=t("rflag.token",{list:c.miss.join(" ")}); nodes.push(b); }
    if (c.extra.length){ const b=document.createElement("span"); b.className="rflag miss"; b.textContent=t("rflag.extra",{list:c.extra.join(" ")}); nodes.push(b); }
    if (c.sameEng){ const b=document.createElement("span"); b.className="rflag same"; b.textContent=t("rflag.sameRef"); nodes.push(b); }
    if (c.ws && c.ws.any){ const b=document.createElement("span"); b.className="rflag ws"; b.textContent=t("rflag.ws",{list:wsLabel(c.ws)}); nodes.push(b); }
    return nodes;
  }

  function buildReviewRow(e){
    const c = computeReview(e);
    const row = document.createElement("div");
    row.className = "rrow " + (c.flagged ? "flag" : c.mt ? "mt" : "");
    row.dataset.idx = e.id;

    // meta
    const meta = document.createElement("div"); meta.className = "rmeta";
    const key = document.createElement("button"); key.className="rkey"; key.textContent=e.key; key.title=t("card.copyKey");
    key.onclick = () => { navigator.clipboard?.writeText(e.key); toast(t("toast.keyCopied")); };
    const flags = document.createElement("div"); flags.className="rflags"; flags.dataset.role="rflags";
    flagNodes(c).forEach(n=>flags.appendChild(n));
    meta.appendChild(key); meta.appendChild(flags);

    // english
    const en = document.createElement("div"); en.className="rcol";
    const enSrc = referenceSource(e);
    en.innerHTML = `<span class="rlabel">${esc(t("review.referenceLabel"))}</span>` + (enSrc != null
      ? `<div class="ren">${highlight(enSrc)}</div>`
      : `<div class="ren empty-ref">${esc(t("review.noRef"))}</div>`);

    // translation (editable)
    const ru = document.createElement("div"); ru.className="rcol rru";
    const lbl = document.createElement("span"); lbl.className="rlabel"; lbl.textContent=t("review.trLabel");
    const {wrap: taWrap, ta} = makeTextarea(true);
    ta.value = e.value; ta.spellcheck = state.spellcheck; ta.lang = state.targetLang || "ru";
    autosize(ta); syncWs(ta);
    const miss = document.createElement("div"); miss.className="rmiss"; miss.dataset.role="rmiss";
    renderReviewMiss(miss, e, ta, row);
    ta.addEventListener("input", () => {
      e.value = ta.value; e.mtDraft = false; e.touched = true; autosize(ta); syncWs(ta);
      updateReviewRow(row, e); refreshMeter(); updateReviewCounts(); scheduleSave();
    });
    ru.appendChild(lbl); ru.appendChild(taWrap); ru.appendChild(miss);

    // actions
    const act = document.createElement("div"); act.className="ractions";
    const edit = document.createElement("button"); edit.className="rbtn"; edit.textContent=t("review.edit");
    edit.title = t("review.editTitle");
    edit.onclick = () => jumpToEditor(e);
    act.appendChild(edit);
    if (c.mt){
      const ok = document.createElement("button"); ok.className="rbtn ok"; ok.textContent=t("review.checked");
      ok.title = t("review.checkedTitle");
      ok.onclick = () => { e.mtDraft = false; refreshReviewRow(e); refreshMeter(); updateReviewCounts(); scheduleSave(); };
      act.appendChild(ok);
    }
    if (c.ws.any){
      const fx = document.createElement("button"); fx.className="rbtn"; fx.textContent=t("review.wsFix");
      fx.title = t("review.wsFixTitle", {list: wsLabel(c.ws)});
      fx.onclick = () => {
        e.value = wsFix(e); e.touched = true;
        refreshReviewRow(e); refreshMeter(); updateReviewCounts(); scheduleSave(); toast(t("toast.wsFixed"));
      };
      act.appendChild(fx);
    }

    row.appendChild(meta); row.appendChild(en); row.appendChild(ru); row.appendChild(act);
    return row;
  }

  function renderReviewMiss(box, e, ta, row){
    box.innerHTML = "";
    const miss = missingTokens(e);
    for (const tk of miss){
      const chip = document.createElement("button");
      chip.className = "chip miss " + tokClass(tk);
      chip.textContent = tk;
      chip.title = t("tokens.insertMissing");
      chip.onclick = () => { insertAtCursor(ta, tk); e.value = ta.value; e.touched = true; autosize(ta); updateReviewRow(row, e); refreshMeter(); updateReviewCounts(); scheduleSave(); };
      box.appendChild(chip);
    }
  }
  // update flags/class/miss in place, without touching the textarea (keeps focus)
  function updateReviewRow(row, e){
    const c = computeReview(e);
    row.className = "rrow " + (c.flagged ? "flag" : c.mt ? "mt" : "");
    const flags = row.querySelector('[data-role="rflags"]');
    if (flags){ flags.innerHTML=""; flagNodes(c).forEach(n=>flags.appendChild(n)); }
    const miss = row.querySelector('[data-role="rmiss"]');
    const ta = row.querySelector("textarea");
    if (miss && ta) renderReviewMiss(miss, e, ta, row);
  }
  // replace/remove the row (used by actions that don't hold textarea focus)
  function refreshReviewRow(e){
    const row = $("reviewlist").querySelector(`.rrow[data-idx="${e.id}"]`);
    if (!row) return;
    if (!reviewMatch(e)) row.remove();
    else row.replaceWith(buildReviewRow(e));
  }

  function renderReview(){
    AC.hide();
    updateReviewCounts();
    const box = $("reviewlist"); box.innerHTML = "";
    const frag = document.createDocumentFragment();
    let shown = 0;
    for (const e of state.items){
      if (e.type!=="entry" || !reviewMatch(e)) continue;
      frag.appendChild(buildReviewRow(e)); shown++;
    }
    if (shown === 0){
      const d = document.createElement("div");
      d.style.cssText = "text-align:center;color:var(--ink-faint);padding:60px 20px;font-size:14px";
      d.textContent = state.reviewQuery ? t("empty.noMatch")
        : state.reviewFilter==="all" ? t("review.emptyNothing")
        : t("review.emptyCategory");
      frag.appendChild(d);
    }
    box.appendChild(frag); box.scrollTop = 0;
  }

  function jumpToEditor(e){
    const s = statusOf(e);
    state.filter = (s==="same") ? "same" : (s==="missing") ? "missing" : "done";
    document.querySelectorAll(".filt").forEach(b => b.classList.toggle("on", b.dataset.f===state.filter));
    setView("editor");
    requestAnimationFrame(() => {
      const card = $("list").querySelector(`.card[data-idx="${e.id}"]`);
      if (card){ card.scrollIntoView({block:"center"}); const ta=card.querySelector("textarea"); if (ta) ta.focus(); }
    });
  }

  function setView(v){
    state.view = v;
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.dataset.v===v));
    const editor = v==="editor", review = v==="review", diff = v==="diff";
    $("side").style.display = editor ? "flex" : "none";
    $("toolbar").style.display = editor ? "flex" : "none";
    $("mtbar").style.display = editor ? "flex" : "none";
    $("list").style.display = editor ? "block" : "none";
    $("reviewbar").style.display = review ? "flex" : "none";
    $("reviewlist").style.display = review ? "block" : "none";
    $("diffbar").style.display = diff ? "flex" : "none";
    $("difflist").style.display = diff ? "block" : "none";
    if (editor) renderList(); else if (review) renderReview(); else renderDiff();
  }

  // ---------- semantic, token-aware text diff ----------
  function diffEngine(){
    const engine = globalThis.NecesseTokenAwareDiff;
    if (!engine) throw new Error("Token-aware Compare engine is not loaded");
    return engine;
  }

  function diffSegmentsHtml(segments, changedClass){
    if (!segments || !segments.length) return "&nbsp;";
    return segments.map(segment => {
      const text = esc(segment.text);
      return segment.kind === "equal" ? text : `<span class="${changedClass}">${text}</span>`;
    }).join("") || "&nbsp;";
  }

  function diffPrefixHtml(prefix, changed, cls){
    if (!prefix) return "";
    const html = esc(prefix);
    return changed ? `<span class="${cls} diff-prefix">${html}</span>` : html;
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
      box.innerHTML = `<div class="empty-d">${t("diff.empty")}</div>`;
      $("diffStat").textContent = "";
      return;
    }
    const A=state.diffOther.lines, B=buildLang().split(/\r\n|\n/);
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
      `<span class="del">−${summary.deleted}</span> · <span class="chg">~${summary.changed}</span> · <span class="add">+${summary.added}</span> ${esc(t("diff.stat",{total:rows.length}))}` +
      ` <span class="diff-detail">· ${esc(t("diff.changedKeys",{n:summary.changedKeys}))} · ${esc(t("diff.changedValues",{n:summary.changedValues}))} · ${esc(t("diff.prefixOnly",{n:summary.prefixOnly}))}</span>`;

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
    const parts=[`<div class="dhead"><div>${esc(t("diff.headLine"))}</div><div>${esc(state.diffOther.name)}</div><div class="h2">${esc(t("diff.headLine"))}</div><div>${esc(t("diff.headCurrent"))}</div></div>`];
    let hidden=0;
    const flushHidden=()=>{ if (hidden){ parts.push(`<div class="dgap">${esc(t("diff.gap",{n:hidden}))}</div>`); hidden=0; } };
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
        `<div class="drow ${classes}">`+
        `<div class="dnum dnum-l">${row.li>=0?row.li+1:""}</div>`+
        `<div class="dtxt txt-l">${leftHtml}</div>`+
        `<div class="dnum dnum-r side2">${row.ri>=0?row.ri+1:""}</div>`+
        `<div class="dtxt txt-r">${rightHtml}</div>`+
        `</div>`);
    }
    flushHidden();
    if (state.diffOnly && !summary.added && !summary.deleted && !summary.changed)
      parts.push(`<div class="empty-d">${esc(t("diff.identical"))}</div>`);
    box.innerHTML = parts.join("");
    box.scrollTop = 0;
  }

  // ---------- section jump list ----------
  function renderSectionJumps(){
    const box = $("sections"); box.innerHTML = "";
    // count missing per section
    let cur = "—", perSec = {};
    for (const it of state.items){
      if (it.type==="section"){ cur = it.name.replace(/^\[|\]$/g,""); perSec[cur] = perSec[cur]||0; }
      else if (it.type==="entry" && statusOf(it)==="missing"){ perSec[cur]=(perSec[cur]||0)+1; }
    }
    for (const [name,cnt] of Object.entries(perSec)){
      const b = document.createElement("button");
      b.className = "sec-jump";
      b.innerHTML = `${esc(name)}${cnt?`<span class="sc">${cnt}</span>`:""}`;
      b.onclick = () => {
        // ensure section visible: switch to 'all' if current filter hides it
        const heads = [...$("list").querySelectorAll(".sec-head")];
        const target = heads.find(h => h.textContent === name);
        if (target) target.scrollIntoView({block:"start"});
        else { setFilter("all"); requestAnimationFrame(()=>{
          const h2 = [...$("list").querySelectorAll(".sec-head")].find(h=>h.textContent===name);
          if (h2) h2.scrollIntoView({block:"start"});
        }); }
      };
      box.appendChild(b);
    }
  }

  // ---------- machine translation ----------
function targetFromName(name){ 
    let code = cleanName(name).replace(/\.lang$/i, "");
    return code || UI || "en"; 
  }
 function indexItems(){ state.byId = new Map(); for (const it of state.items) if (it.type==="entry") state.byId.set(it.id, it); }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const MT_PROVIDER_KEY = "necesse-translator.mt-provider.v1";
  function providerRegistry(){ return globalThis.NecesseMtProviders || null; }
  function validProvider(provider){
    const registry = providerRegistry();
    return registry && registry.has(provider) ? provider : (registry?.defaultId || "google");
  }
  function preferredProvider(){
    try { return validProvider(localStorage.getItem(MT_PROVIDER_KEY)); }
    catch(e) { return validProvider(""); }
  }
  function setPreferredProvider(provider){
    try { localStorage.setItem(MT_PROVIDER_KEY, validProvider(provider)); } catch(e) {}
  }
  function decodeEntities(s){ const t = document.createElement("textarea"); t.innerHTML = s; return t.value; }

  function currentTargetLang(){
    const live = (($("mtTarget") && $("mtTarget").value) || "").trim();
    if (live) state.targetLang = live;
    return state.targetLang || "";
  }

  // Replace format tokens with sentinels the MT engine should leave untouched,
  // then restore them afterwards. Dropped sentinels surface via the ⚠ chips.
  function maskTokens(str){
    const tokens = [];
    TOKEN_RE.lastIndex = 0;
    const masked = str.replace(TOKEN_RE, m => { const i = tokens.length; tokens.push(m); return "⟦"+i+"⟧"; });
    return {masked, tokens};
  }
  function restoreTokens(str, tokens){
    let out = str;
    tokens.forEach((tk,i) => { out = out.replace(new RegExp("⟦\\s*"+i+"\\s*⟧","g"), () => tk); });
    return out;
  }

  async function callProvider(provider, text, target){
    const registry = providerRegistry();
    if (!registry) throw new Error(t("mt.errUnknownProvider"));
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 13000);
    try{
      return await registry.translate(validProvider(provider), {
        text,
        sourceLanguage: "en",
        targetLanguage: target,
        signal: ctl.signal
      });
    } catch(err){
      if (err.name === "AbortError") throw new Error(t("mt.errTimeout"));
      if (err instanceof TypeError) throw new Error(t("mt.errNetwork"));
      if (err.code === "invalid-response") throw new Error(t("mt.errGoogle"));
      if (err.code === "unknown-provider") throw new Error(t("mt.errUnknownProvider"));
      throw err;
    } finally { clearTimeout(to); }
  }

  async function mtTranslate(text){
    if (!text.trim()) return "";
    const {masked, tokens} = maskTokens(text);
    const res = await callProvider(state.mtProvider, masked, currentTargetLang());
    return restoreTokens(res, tokens);
  }

  let mtBusy = false;
  async function translateEntry(e, ta, card, btn){
    if (btn.classList.contains("loading") || mtBusy) return;   // one request at a time
    // Must translate the English original (en.lang ref / missing inline), never the
    // already-translated e.english/e.value — that produced Russian→Russian with sl=en.
    const src = referenceSource(e);
    if (src == null){ toast(t("mt.needReference")); return; }
    if (!String(src).trim()){ toast(t("mt.emptySrc")); return; }
    mtBusy = true;
    btn.classList.add("loading"); btn.disabled = true;
    try{
      const sug = await mtTranslate(src);
      if (sug && sug.trim()){ e.value = sug; e.mtDraft = true; e.touched = true; ta.value = sug; autosize(ta); syncWs(ta); }
      updateCard(card, e); refreshMeter(); scheduleSave();
    } catch(err){ toast(t("mt.prefix", {msg: err.message || t("err.generic")})); }
    finally{ btn.classList.remove("loading"); btn.disabled = false; mtBusy = false; }
  }

  // ---------- export ----------
  function buildLang(){
    const out = [];
    for (const it of state.items){
      if (it.type !== "entry"){ out.push(it.raw); continue; }
      const s = statusOf(it);
      // Preserve an explicit SAME_TRANSLATION file marker even when no external
      // reference is loaded; reference availability only gates the UI status.
      if (it.markedSame) out.push(SAME + it.key + "=" + it.value);
      else if (s === "missing") out.push(MISS + it.key + "=" + it.value);
      else out.push(it.key + "=" + it.value);
    }
    return out.join(state.eol);
  }
  function download(name, text, mime){
    const blob = new Blob([text], {type: mime||"text/plain;charset=utf-8"});
    downloadBlob(name, blob);
  }
  function downloadBlob(name, blob){
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }
  const canGzip = typeof CompressionStream !== "undefined";
  async function gzipBlob(text){
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
    return await new Response(stream).blob();
  }
  async function gunzipText(buf){
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).text();
  }
  function fmtBytes(n){
    return n >= 1048576 ? (n/1048576).toFixed(1)+t("bytes.mb")
         : n >= 1024    ? Math.round(n/1024)+t("bytes.kb") : n+t("bytes.b");
  }

  // ---------- persistence ----------
  // Compact format v2: single-letter top-level keys, entries as tuples, flags bit-packed,
  // redundant fields dropped (english when it equals value, non-entry lines stored as raw
  // strings and re-classified on load). ~3x smaller than v1, which matters for the
  // localStorage quota once an en.lang reference is attached.
  const F_SAME=1, F_MISSING=2, F_MT=4, F_TOUCHED=8;

  function serialize(){
    const i = state.items.map(it => {
      if (it.type !== "entry") return it.raw || "";
      let f = 0;
      if (it.markedSame) f |= F_SAME;
      if (it.wasMissing) f |= F_MISSING;
      if (it.mtDraft)    f |= F_MT;
      if (it.touched)    f |= F_TOUCHED;
      const row = [it.key, it.value, f];
      const needEng = it.english !== it.value;
      const hasRef  = it.ref != null;
      if (needEng || hasRef) row.push(needEng ? it.english : 0);
      if (hasRef) row.push(it.ref);
      return row;
    });
    return {
      v:2, f:state.filename, e:(state.eol === "\r\n" ? 1 : 0), s:Date.now(), n:state.referenceFilename || "",
      m:{p:state.mtProvider, t:state.targetLang, s:state.spellcheck?1:0, a:state.acEnabled?1:0},
      i
    };
  }

  function deserialize(data){
    if (!data || (data.v !== 2 && !data.items)) throw new Error(t("err.unknownFormat"));
    if (data.v === 2) return deserializeV2(data);
    return deserializeV1(data);
  }

  function deserializeV2(d){
    state.filename = d.f || "";
    state.referenceFilename = d.n || "";
    state.eol = d.e ? "\r\n" : "\n";
    state.savedAt = d.s || 0;
    const m = d.m || {};
    state.mtProvider = validProvider(m.p || state.mtProvider);
    state.targetLang = m.t || targetFromName(state.filename);
    state.spellcheck = m.s !== 0;
    state.acEnabled = m.a !== 0;
    state.items = (d.i || []).map((row, idx) => {
      if (!Array.isArray(row)) return classifyLine(String(row));
      const [key, value, f, eng, ref] = row;
      const e = {type:"entry", id:idx, key, value,
                 english: (eng === 0 || eng === undefined) ? value : eng,
                 markedSame: !!(f & F_SAME), wasMissing: !!(f & F_MISSING),
                 mtDraft: !!(f & F_MT), touched: !!(f & F_TOUCHED)};
      if (ref != null) e.ref = ref;
      return e;
    });
  }

  // legacy verbose format
  function deserializeV1(data){
    state.filename = data.filename || "";
    state.referenceFilename = data.referenceFilename || "";
    state.eol = data.eol || "\r\n";
    state.savedAt = data.savedAt || 0;
    if (data.mt){
      state.mtProvider = validProvider(data.mt.provider || state.mtProvider);
      state.targetLang = data.mt.target || targetFromName(state.filename);
      state.spellcheck = data.mt.spell !== false;
      state.acEnabled = data.mt.ac !== false;
    } else { state.targetLang = targetFromName(state.filename); }
    state.items = data.items.map((d,idx) => {
      if (d.t === "e") return {type:"entry", id:idx, key:d.key, english:d.english, value:d.value,
                               markedSame:!!d.markedSame, wasMissing:!!d.wasMissing,
                               mtDraft:!!d.mtDraft, touched:!!d.touched, ref:(d.ref != null ? d.ref : undefined)};
      return classifyLine(d.raw || "");
    });
  }
  function saveLS(){
    try{
      localStorage.setItem(LS_KEY, JSON.stringify(serialize()));
      state.savedAt = Date.now();
      setSaveState("saved");
      return true;
    }catch(e){
      setSaveState("error");
      return false;
    }
  }
  function scheduleSave(){
    setSaveState("saving");
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(saveLS, 500);
  }
  function setSaveState(kind){
    const pill = $("savePill"); if (!pill) return;
    pill.classList.remove("saving","error");
    if (kind === "saving"){ pill.classList.add("saving"); $("saveText").textContent = t("save.saving"); return; }
    if (kind === "error"){ pill.classList.add("error"); $("saveText").textContent = t("save.error"); return; }
    updateSaveText();
  }
  function updateSaveText(){
    const pill = $("savePill");
    if (!pill || pill.classList.contains("saving") || pill.classList.contains("error")) return;
    if (!state.savedAt){ $("saveText").textContent = t("save.saved"); return; }
    const d = new Date(state.savedAt);
    const hh = String(d.getHours()).padStart(2,"0"), mm = String(d.getMinutes()).padStart(2,"0");
    const c = counts();
    $("saveText").textContent = t("save.savedAt", {time: hh+":"+mm, n: c.done});
  }

  // ---------- UI wiring ----------
  let pendingRecovery = null;
  function dismissPendingRecovery({discardStored = false} = {}){
    pendingRecovery = null;
    const banner = $("restore");
    if (banner) banner.style.display = "none";
    if (discardStored){
      try{ localStorage.removeItem(LS_KEY); }catch(e){}
    }
  }

  function openWorkspace(){
    // Any workspace that becomes active supersedes the startup recovery offer.
    dismissPendingRecovery();
    $("empty").style.display = "none";
    $("side").style.display = "flex";
    $("toolbar").style.display = "flex";
    $("mtbar").style.display = "flex";
    $("list").style.display = "block";
    $("footnote").style.display = "block";
    $("meter").style.display = "flex";
    $("topActions").style.display = "flex";
    $("outName").value = state.filename;
    state.mtProvider = validProvider(state.mtProvider);
    const providerSelect = $("mtProvider");
    if (providerSelect){
      providerSelect.innerHTML = "";
      const registry = providerRegistry();
      for (const provider of (registry ? registry.getAll() : [])){
        const option = document.createElement("option");
        option.value = provider.id;
        option.textContent = provider.name;
        providerSelect.appendChild(option);
      }
      providerSelect.value = state.mtProvider;
      providerSelect.disabled = providerSelect.options.length < 2;
    }
    $("mtTarget").value = state.targetLang;
    $("spellToggle").classList.toggle("on", state.spellcheck);
    $("acToggle").classList.toggle("on", state.acEnabled);
    $("tabs").style.display = "flex";
    state.view = "editor"; state.reviewFilter = "all"; state.reviewQuery = "";
    $("reviewSearch").value = "";
    $("queryHint").textContent = "";
    $("diffName").textContent = state.diffOther ? t("diff.fileInfo", {name: state.diffOther.name, n: state.diffOther.lines.length}) : "";
    $("diffOnlyToggle").classList.toggle("on", state.diffOnly);
    document.querySelectorAll(".rchip").forEach(x => x.classList.toggle("on", x.dataset.r==="all"));
    indexItems(); buildDict(); updateReferenceBtn();
    refreshMeter(); renderSectionJumps(); setView("editor"); saveLS();
  }
  function loadWorkspaceFromText(text, options = {}){
    const config = typeof options === "string" ? {filename: options} : (options || {});
    const {eol, items} = parse(String(text ?? ""));
    state.eol = eol;
    state.items = items;
    state.filename = config.filename ? cleanName(config.filename) : "";
    state.referenceFilename = "";
    if (config.referenceFilename) state.referenceFilename = String(config.referenceFilename);
    state.diffOther = null;
    state.mtProvider = preferredProvider();
    state.targetLang = Object.hasOwn(config, "targetLang")
      ? String(config.targetLang || "")
      : targetFromName(state.filename);
    state.filter = "missing";
    state.query = "";
    $("search").value = "";
    setFilter("missing", true);
    openWorkspace();
  }
  globalThis.NecesseLangTranslator = Object.freeze({loadWorkspaceFromText});
  function setFilter(f, silent){
    state.filter = f;
    document.querySelectorAll(".filt").forEach(b => b.classList.toggle("on", b.dataset.f===f));
    if (!silent) renderList();
  }

  function toast(msg){
    const t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(()=>t.classList.remove("show"), 1600);
  }

  // file pickers
  $("btnPick").onclick = () => $("fileInput").click();
  $("fileInput").onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { loadWorkspaceFromText(r.result, {filename: f.name}); toast(t("toast.fileLoaded")); };
    r.readAsText(f, "UTF-8");
    e.target.value = "";
  };
  $("btnNew").onclick = () => $("fileInput").click();
  $("btnExport").onclick = () => {
    let name = ($("outName").value || "").trim() || state.filename;
    if (!name){
      toast(t("err.targetFilenameRequired"));
      $("outName").focus();
      return;
    }
    if (!/\.lang$/i.test(name)) name += ".lang";
    state.filename = name; $("outName").value = name;
    download(name, buildLang(), "text/plain;charset=utf-8");
    toast(t("toast.exported", {name}));
  };
  $("btnSaveJson").onclick = async () => {
    const base = (state.filename || "translation.lang").replace(/\.lang$/i,"");
    const text = JSON.stringify(serialize());
    if (canGzip){
      try{
        const blob = await gzipBlob(text);
        downloadBlob(base + ".progress.json.gz", blob);
        toast(t("toast.progressSavedGz", {size: fmtBytes(blob.size), raw: fmtBytes(text.length)}));
        return;
      }catch(err){ /* fall back to plain json */ }
    }
    download(base + ".progress.json", text, "application/json");
    toast(t("toast.progressSaved", {size: fmtBytes(text.length)}));
  };
  $("btnLoadJson").onclick = () => $("jsonInput").click();
  $("jsonInput").onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      try{
        const buf = new Uint8Array(r.result);
        let text;
        if (buf[0] === 0x1f && buf[1] === 0x8b){          // gzip magic
          if (!canGzip) throw new Error(t("err.noGzip"));
          text = await gunzipText(buf);
        } else {
          text = new TextDecoder("utf-8").decode(buf);
        }
        deserialize(JSON.parse(text));
        setFilter("missing",true); openWorkspace();
        toast(t("toast.progressRestored"));
      } catch(err){ toast(t("err.readFile", {msg: err.message || t("err.generic")})); }
    };
    r.readAsArrayBuffer(f); e.target.value = "";
  };
  $("btnEnRef").onclick = () => $("enInput").click();
  $("enInput").onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const map = parseReferenceLang(r.result);
      const n = applyReference(map);
      state.referenceFilename = f.name;
      updateReferenceBtn();
      (state.view === "review" ? renderReview : renderList)();
      refreshMeter(); saveLS();
      toast(t("toast.referenceMatched", {file: f.name, n}));
    };
    r.readAsText(f, "UTF-8"); e.target.value = "";
  };

  // filters + search
  document.getElementById("filters").addEventListener("click", e => {
    const b = e.target.closest(".filt"); if (b) setFilter(b.dataset.f);
  });
  let searchTimer;
  // NB: no trim() — spaces are searchable, which is the point of finding "  ".
  function applyQuery(v){
    state.query = v;
    const h = $("queryHint");
    if (h){
      if (v && (RE_LEAD.test(v) || RE_TRAIL.test(v) || RE_DBL.test(v) || /[\t\u00A0]/.test(v))){
        const n = state.items.filter(e => e.type==="entry" && matchFilter(e)).length;
        h.textContent = t("query.hint", {q: wsGlyphs(v), n});
      } else h.textContent = "";
    }
    renderList();
  }
  $("search").addEventListener("input", e => {
    clearTimeout(searchTimer);
    const v = e.target.value;
    searchTimer = setTimeout(() => applyQuery(v), 160);
  });
  $("btnFindDbl").addEventListener("click", () => {
    setFilter("all", true);
    $("search").value = "  ";
    applyQuery("  ");
    $("search").focus();
  });
  $("btnFindTab").addEventListener("click", () => {
    setFilter("all", true);
    $("search").value = "\t";
    applyQuery("\t");
    $("search").focus();
  });

  // MT + spellcheck controls
  $("mtProvider")?.addEventListener("change", event => {
    state.mtProvider = validProvider(event.target.value);
    event.target.value = state.mtProvider;
    setPreferredProvider(state.mtProvider);
    scheduleSave();
  });
  // Push spellcheck settings onto already-rendered textareas — never rebuild the list.
  function applySpellcheckToVisible(){
    const on = !!state.spellcheck;
    const lang = state.targetLang || "";
    document.querySelectorAll(".tawrap > textarea").forEach(ta => {
      ta.lang = lang;
      // Browsers only re-check after spellcheck is toggled off→on with the new lang.
      ta.spellcheck = false;
      if (on){ void ta.offsetHeight; ta.spellcheck = true; }
    });
  }
  $("spellToggle").addEventListener("click", () => {
    state.spellcheck = !state.spellcheck;
    $("spellToggle").classList.toggle("on", state.spellcheck);
    applySpellcheckToVisible();
    scheduleSave();
  });
  $("acToggle").addEventListener("click", () => {
    state.acEnabled = !state.acEnabled;
    $("acToggle").classList.toggle("on", state.acEnabled);
    if (!state.acEnabled) AC.hide();
    scheduleSave();
  });
  function commitMtTarget(raw){
    let v = String(raw || "").trim().replace(/_/g, "-");
    // Surface the common typo fix in the field itself so the UI matches what Google gets.
    if (/^pr(-br)?$/i.test(v)) v = "pt" + v.slice(2);
    if (v === state.targetLang && $("mtTarget").value === v) return;
    state.targetLang = v;
    $("mtTarget").value = v;
    applySpellcheckToVisible();
    scheduleSave();
  }
  $("mtTarget").addEventListener("change", e => commitMtTarget(e.target.value));
  $("mtTarget").addEventListener("blur", e => commitMtTarget(e.target.value));
  $("mtTarget").addEventListener("keydown", e => {
    if (e.key === "Enter"){ e.preventDefault(); e.target.blur(); }
  });
  $("mtTarget").addEventListener("input", e => { state.targetLang = e.target.value.trim() || state.targetLang; });

  // tabs + review controls
  $("tabs").addEventListener("click", e => { const t = e.target.closest(".tab"); if (t) setView(t.dataset.v); });
  $("btnDiffFile").addEventListener("click", () => $("diffInput").click());
  $("diffInput").addEventListener("change", e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      state.diffOther = {name: f.name, lines: String(r.result).split(/\r\n|\n/)};
      $("diffName").textContent = t("diff.fileInfo", {name: f.name, n: state.diffOther.lines.length});
      renderDiff();
      toast(t("toast.diffLoaded"));
    };
    r.readAsText(f, "UTF-8"); e.target.value = "";
  });
  $("diffOnlyToggle").addEventListener("click", () => {
    state.diffOnly = !state.diffOnly;
    $("diffOnlyToggle").classList.toggle("on", state.diffOnly);
    renderDiff();
  });
  $("diffInlineMode").addEventListener("click", event => {
    const button = event.target.closest("[data-diff-mode]");
    if (!button) return;
    state.diffMode = button.dataset.diffMode === "character" ? "character" : "word";
    syncDiffModeControls();
    renderDiff();
  });
  $("reviewbar").addEventListener("click", e => {
    const c = e.target.closest(".rchip"); if (!c) return;
    state.reviewFilter = c.dataset.r;
    document.querySelectorAll(".rchip").forEach(x => x.classList.toggle("on", x===c));
    renderReview();
  });
  let rSearchTimer;
  $("reviewSearch").addEventListener("input", e => {
    clearTimeout(rSearchTimer);
    const v = e.target.value;   // no trim: spaces are searchable here as well
    rSearchTimer = setTimeout(() => { state.reviewQuery = v; renderReview(); }, 160);
  });

  // drag & drop
  const drop = $("drop");
  ["dragenter","dragover"].forEach(ev => drop.addEventListener(ev, e=>{e.preventDefault();drop.classList.add("over");}));
  ["dragleave","drop"].forEach(ev => drop.addEventListener(ev, e=>{e.preventDefault();drop.classList.remove("over");}));
  drop.addEventListener("drop", e => {
    const f = e.dataTransfer.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => { loadWorkspaceFromText(r.result, {filename: f.name}); toast(t("toast.fileLoaded")); };
    r.readAsText(f, "UTF-8");
  });

  // restore banner
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

  // warn before leaving with unsaved-to-file changes
  window.addEventListener("beforeunload", e => {
    if (state.items.length){ saveLS(); }
  });
  // flush save on tab hide / mobile background — more reliable than beforeunload
  window.addEventListener("pagehide", () => { if (state.items.length) saveLS(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && state.items.length) saveLS();
  });
  // click the pill to review what's already translated
  $("savePill").addEventListener("click", () => { if (state.items.length) setView("review"); });
  // keep the "N готово / time" label honest even when idle
  setInterval(updateSaveText, 30000);

  // ---------- autocomplete (words from translated text) ----------
  function wordsOf(str){
    const noTok = str.replace(TOKEN_RE, " ");
    return noTok.match(/[\p{L}][\p{L}'’\-]{1,}/gu) || [];
  }
  function buildDict(){
    AC.dict = new Map();
    for (const e of state.items){
      if (e.type!=="entry") continue;
      const s = statusOf(e);
      // only real target-language text: file/user translations, not untouched English
      if (s==="done" || s==="same" || e.touched) AC.learnValue(e.value);
    }
  }

  const AC = {
    dict: new Map(),
    box: null, mirror: null,
    open: false, ta: null, cw: null, items: [], active: 0,
    suppressOnce: false,

    learnValue(v){
      for (const w of wordsOf(v)){
        const k = w.toLowerCase();
        if (k.length < 2) continue;
        this.dict.set(k, (this.dict.get(k)||0) + 1);
      }
    },
    suggest(prefix){
      const p = prefix.toLowerCase();
      const out = [];
      for (const [w,c] of this.dict){
        if (w.length > p.length && w.startsWith(p)) out.push([w,c]);
      }
      out.sort((a,b) => b[1]-a[1] || a[0].length-b[0].length || a[0].localeCompare(b[0]));
      return out.slice(0,7).map(r => ({w:r[0], c:r[1]}));
    },
    applyCase(prefix, word){
      if (prefix && prefix[0] !== prefix[0].toLowerCase() && prefix[0] === prefix[0].toUpperCase())
        return word.charAt(0).toUpperCase() + word.slice(1);
      return word;
    },
    currentWord(ta){
      const pos = ta.selectionStart;
      if (pos !== ta.selectionEnd) return null;
      const m = ta.value.slice(0, pos).match(/[\p{L}][\p{L}'’\-]*$/u);
      if (!m) return null;
      return {word: m[0], start: pos - m[0].length, end: pos};
    },
    ensureDOM(){
      if (this.box) return;
      this.box = document.createElement("div"); this.box.className = "acbox";
      this.box.addEventListener("mousedown", ev => {
        const it = ev.target.closest(".acitem"); if (!it) return;
        ev.preventDefault();            // keep textarea focus
        this.accept(this.items[+it.dataset.i]);
      });
      document.body.appendChild(this.box);
    },
    caretXY(ta){
      if (!this.mirror){
        this.mirror = document.createElement("div");
        this.mirror.style.cssText = "position:fixed;visibility:hidden;white-space:pre-wrap;word-wrap:break-word;overflow:hidden;z-index:-1;top:0;left:0";
        document.body.appendChild(this.mirror);
      }
      const div = this.mirror, cs = getComputedStyle(ta), r = ta.getBoundingClientRect();
      ["boxSizing","paddingTop","paddingRight","paddingBottom","paddingLeft",
       "borderTopWidth","borderRightWidth","borderBottomWidth","borderLeftWidth",
       "fontStyle","fontVariant","fontWeight","fontStretch","fontSize","fontFamily",
       "lineHeight","letterSpacing","textAlign","textTransform","wordSpacing","textIndent","tabSize"]
        .forEach(p => div.style[p] = cs[p]);
      div.style.width = cs.width;
      div.style.left = r.left + "px";
      div.style.top  = r.top + "px";
      div.textContent = ta.value.slice(0, this.cw.end);
      const span = document.createElement("span");
      span.textContent = ta.value.slice(this.cw.end) || ".";
      div.appendChild(span);
      const sr = span.getBoundingClientRect();
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize)*1.4;
      div.textContent = "";
      return {left: sr.left, top: sr.top - ta.scrollTop, bottom: sr.top - ta.scrollTop + lh};
    },
    show(ta, cw, list){
      this.ensureDOM();
      this.ta = ta; this.cw = cw; this.items = list; this.active = 0; this.open = true;
      const pfxLen = cw.word.length;
      this.box.innerHTML = list.map((it,i) => {
        const disp = this.applyCase(cw.word, it.w);
        const head = disp.slice(0, pfxLen), tail = disp.slice(pfxLen);
        return `<div class="acitem${i===0?" active":""}" data-i="${i}"><span class="acw"><b>${esc(head)}</b>${esc(tail)}</span><span class="acc">${it.c}</span></div>`;
      }).join("") + `<div class="achint">${esc(t("ac.hint"))}</div>`;
      const c = this.caretXY(ta);
      this.box.classList.add("on");
      const bw = this.box.offsetWidth, bh = this.box.offsetHeight;
      let left = c.left, top = c.bottom + 2;
      if (left + bw > window.innerWidth - 8) left = window.innerWidth - bw - 8;
      if (top + bh > window.innerHeight - 8) top = c.top - bh - 2;   // flip above caret
      this.box.style.left = Math.max(8, left) + "px";
      this.box.style.top  = Math.max(8, top) + "px";
    },
    render(){
      [...this.box.querySelectorAll(".acitem")].forEach((el,i) => {
        el.classList.toggle("active", i===this.active);
        if (i===this.active) el.scrollIntoView({block:"nearest"});
      });
    },
    move(d){ if (!this.open) return; this.active = (this.active + d + this.items.length) % this.items.length; this.render(); },
    hide(){ if (this.box) this.box.classList.remove("on"); this.open = false; this.ta = null; },
    accept(item){
      if (!this.ta || !item) return;
      const word = typeof item === "string" ? item : item.w;
      const ta = this.ta, cw = this.cw, cased = this.applyCase(cw.word, word);
      ta.value = ta.value.slice(0, cw.start) + cased + ta.value.slice(cw.end);
      const caret = cw.start + cased.length;
      ta.setSelectionRange(caret, caret);
      this.hide();
      this.suppressOnce = true;
      ta.dispatchEvent(new Event("input", {bubbles:true}));  // sync value/touched/save
      ta.focus();
    },
    onInput(ta){
      this.learnValue(ta.value);
      if (this.suppressOnce){ this.suppressOnce = false; this.hide(); return; }
      if (!state.acEnabled){ this.hide(); return; }
      const cw = this.currentWord(ta);
      const nextCh = ta.value[ta.selectionStart];
      if (!cw || cw.word.length < 2 || (nextCh && /[\p{L}]/u.test(nextCh))){ this.hide(); return; }
      const list = this.suggest(cw.word);
      if (!list.length){ this.hide(); return; }
      this.show(ta, cw, list);
    },
    onKey(e){
      if (!this.open) return;
      switch(e.key){
        case "ArrowDown": e.preventDefault(); e.stopPropagation(); this.move(1); break;
        case "ArrowUp":   e.preventDefault(); e.stopPropagation(); this.move(-1); break;
        case "Enter":
          if (e.ctrlKey || e.metaKey){ this.hide(); return; }  // let Ctrl+Enter = next missing
          e.preventDefault(); e.stopPropagation(); this.accept(this.items[this.active]); break;
        case "Tab":       e.preventDefault(); e.stopPropagation(); this.accept(this.items[this.active]); break;
        case "Escape":    e.preventDefault(); e.stopPropagation(); this.hide(); break;
      }
    },
  };

  function isTAInput(el){ return el && el.tagName === "TEXTAREA" && (el.classList.contains("tr") || el.closest(".rru")); }
  document.addEventListener("keydown", e => { if (isTAInput(e.target)) AC.onKey(e); }, true);
  document.addEventListener("input",   e => { if (isTAInput(e.target)) AC.onInput(e.target); });
  document.addEventListener("focusout",e => { if (isTAInput(e.target)) setTimeout(() => AC.hide(), 120); });
  document.addEventListener("scroll",  () => AC.hide(), true);
  window.addEventListener("resize",    () => AC.hide());

  // UI language switcher
  $("uiLang").addEventListener("change", e => setUiLang(e.target.value));
  $("uiLang").value = UI;
  applyI18n();

  tryRestore();
})();
