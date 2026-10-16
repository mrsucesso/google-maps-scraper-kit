// Maps Scraper — front-end for the local gosom/google-maps-scraper REST API.
// Talks to same-origin /api/v1 (proxied by nginx), Nominatim for geocoding, OpenStreetMap tiles for the map.
(() => {
  "use strict";

  const API = "/api/v1/jobs";
  const POLL_MS = 4000;
  const JOINER = { pt: "em", en: "in", es: "en" };   // "dentista em Barra Funda"
  const STATUS = { ok: "Concluída", working: "Pesquisando…", pending: "Na fila", failed: "Falhou" };
  const AMOUNT_HINT = {
    1: "Aproximado · leva ~2 min",
    5: "Aproximado · leva ~4 min",
    10: "Aproximado · leva ~7 min",
    20: "Aproximado · leva 15+ min",
  };
  const ICON = {
    search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
    list: '<svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>',
    del: '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>',
    web: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.93 6h-2.95a15.65 15.65 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.93 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14a8.2 8.2 0 0 1 0-4h3.38a16.5 16.5 0 0 0 0 4H4.26zm.81 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.99 7.99 0 0 1 5.07 16zm2.95-8H5.07a7.99 7.99 0 0 1 4.33-3.56A15.65 15.65 0 0 0 8.02 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66a14.7 14.7 0 0 1 0-4h4.68a14.7 14.7 0 0 1 0 4zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14a16.5 16.5 0 0 0 0-4h3.38a8.2 8.2 0 0 1 0 4h-3.38z"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z"/></svg>',
    wa: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 1-2.3.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/></svg>',
    dir: '<svg viewBox="0 0 24 24"><path d="M21.71 11.29l-9-9a1 1 0 0 0-1.42 0l-9 9a1 1 0 0 0 0 1.42l9 9a1 1 0 0 0 1.42 0l9-9a1 1 0 0 0 0-1.42zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z"/></svg>',
  };
  const PIN = (color) => `<svg viewBox="0 0 27 43"><path fill="${color}" stroke="#fff" stroke-width="1.5" d="M13.5 1C6.6 1 1 6.6 1 13.5 1 23 13.5 42 13.5 42S26 23 26 13.5C26 6.6 20.4 1 13.5 1z"/><circle cx="13.5" cy="13.5" r="4.5" fill="#fff" fill-opacity=".9"/></svg>`;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => (+n || 0).toLocaleString("pt-BR");
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  // Jobs come back with Go-style capitalized keys; accept either.
  const norm = (j) => {
    const d = j.Data || j.data || {};
    return {
      id: j.ID || j.id, name: j.Name || j.name, date: j.Date || j.date,
      status: (j.Status || j.status || "").toLowerCase(), keywords: d.keywords || [],
      depth: d.depth, email: d.email, lang: d.lang,
      lat: +d.lat || 0, lon: +d.lon || 0, radius: +d.radius || 0,
    };
  };

  const state = {
    jobs: [], counts: {}, prevStatus: {}, current: null, rows: [], visible: [],
    sort: { key: null, dir: 1 }, geo: null, submitting: false, depth: 5, email: false,
  };

  // ───────────────────────── utils ─────────────────────────
  function toast(msg, ms = 4000) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), ms);
  }
  function store(k, v) { try { localStorage.setItem("ms:" + k, JSON.stringify(v)); } catch {} }
  function load(k, d) { try { const v = localStorage.getItem("ms:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } }

  function ago(iso) {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "agora";
    if (s < 3600) return `há ${Math.floor(s / 60)} min`;
    if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
    return new Date(iso).toLocaleDateString("pt-BR");
  }

  // RFC 4180 CSV parser (quoted fields, embedded commas/newlines).
  function parseCSV(text) {
    const rows = []; let row = [], f = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
      else if (c !== "\r") f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    const [head, ...body] = rows;
    if (!head) return [];
    head[0] = head[0].replace(/^﻿/, "");
    return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
  }

  function toCSV(headers, rows, sep) {
    const cell = (v) => { v = String(v ?? ""); return /[";,\n\r\t]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
    return [headers, ...rows].map((r) => r.map(cell).join(sep)).join("\r\n");
  }

  function saveFile(name, content, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  const slug = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "busca";
  const digits = (s) => String(s || "").replace(/\D/g, "");
  const emailsOf = (r) => String(r.emails || "").split(/[\s,;]+/).filter((e) => e.includes("@"));

  // Brazilian mobile (DDD + 9xxxxxxxx) → wa.me link.
  function whatsapp(phone) {
    let d = digits(phone);
    if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
    return d.length === 11 && d[2] === "9" ? `https://wa.me/55${d}` : null;
  }

  // Great-circle distance in meters.
  function distance(lat1, lon1, lat2, lon2) {
    const R = 6371000, rad = Math.PI / 180;
    const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  // Google Maps has no hard radius in normal mode, so we zoom the search viewport to fit the circle
  // (~1000px wide at 156543·cos(lat)/2^z m/px) and filter results outside it afterwards.
  const zoomFor = (meters, lat) => Math.max(11, Math.min(17, Math.round(Math.log2((156543 * Math.cos((lat * Math.PI) / 180) * 1000) / (2 * meters)))));

  function starsHTML(rating) {
    const full = Math.round(rating);
    return `<span class="stars" aria-hidden="true">${"★".repeat(full)}<span class="off">${"★".repeat(5 - full)}</span></span>`;
  }

  // ───────────────────────── map ─────────────────────────
  const hasMap = typeof L !== "undefined";
  let map, markerLayer, lookupMarker;
  const markers = {};
  if (hasMap) {
    const last = load("view", { lat: 0, lon: 0, z: 2 });
    map = L.map("map", { zoomControl: false }).setView([last.lat, last.lon], last.z);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, className: "map-tiles",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    map.on("moveend", () => { const c = map.getCenter(); store("view", { lat: c.lat, lon: c.lng, z: map.getZoom() }); });
  }
  // The map runs under the floating sidebar, so frame things in the part of the map you can see.
  function framePad() {
    const sb = $("#panel").getBoundingClientRect();
    const covers = sb.width < window.innerWidth * 0.8 && getComputedStyle($("#panel")).position === "fixed";
    return { paddingTopLeft: [covers ? sb.right + 32 : 32, 32], paddingBottomRight: [32, 32] };
  }
  function focusPoint(latlng, zoom) {
    const ll = L.latLng(latlng);
    map.flyToBounds(L.latLngBounds(ll, ll), { ...framePad(), maxZoom: zoom, duration: 0.7 });
  }
  const pinIcon = (color, hl) => hasMap && L.divIcon({ className: "pin-icon" + (hl ? " hl" : ""), html: PIN(color), iconSize: [27, 43], iconAnchor: [13.5, 42], popupAnchor: [0, -38] });

  let areaCircle;
  function drawArea(lat, lon, meters, fit) {
    if (!hasMap) return;
    if (areaCircle) areaCircle.remove();
    if (!lat || !meters) { areaCircle = null; return; }
    areaCircle = L.circle([lat, lon], { radius: meters, color: "#1a73e8", weight: 2, opacity: .7, fillColor: "#1a73e8", fillOpacity: .08, interactive: false }).addTo(map);
    if (fit) map.flyToBounds(areaCircle.getBounds(), { ...framePad(), duration: 0.5 });
  }
  const radiusMeters = () => (+$("#radius").value || 5) * 1000;

  function showLookup(g) {
    if (!hasMap) return;
    if (lookupMarker) lookupMarker.remove();
    if (!g) { drawArea(); return; }
    lookupMarker = L.marker([g.lat, g.lon], { icon: pinIcon("#1a73e8") }).addTo(map);
    if (!state.current) drawArea(+g.lat, +g.lon, radiusMeters(), true);
  }

  function plotRows(rows) {
    if (!hasMap) return;
    markerLayer.clearLayers();
    for (const k in markers) delete markers[k];
    const pts = [];
    rows.forEach((r, i) => {
      const lat = +r.latitude, lon = +r.longitude;
      if (!lat || !lon) return;
      markers[i] = L.marker([lat, lon], { icon: pinIcon("#ea4335"), riseOnHover: true })
        .bindPopup(`<b>${esc(r.title)}</b><br>${esc(r.category)}${r.review_rating ? ` · ${(+r.review_rating).toFixed(1).replace(".", ",")} ★` : ""}${r.phone ? `<br>${esc(r.phone)}` : ""}`)
        .on("click", () => highlight(i, true))
        .addTo(markerLayer);
      pts.push([lat, lon]);
    });
    if (pts.length) map.fitBounds(pts, { ...framePad(), maxZoom: 16 });
  }

  function highlight(i, scroll) {
    $$(".place.hl").forEach((el) => el.classList.remove("hl"));
    Object.entries(markers).forEach(([k, m]) => m.setIcon(pinIcon("#ea4335", +k === i)));
    const el = $(`.place[data-i="${i}"]`);
    if (el) { el.classList.add("hl"); if (scroll) el.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  }

  // ───────────────────────── health + jobs ─────────────────────────
  function setHealth(ok) {
    const h = $("#health");
    h.className = "health " + (ok ? "ok" : "down");
    h.lastElementChild.textContent = ok ? "scraper online" : "offline: abra o Docker Desktop";
  }

  async function refreshJobs() {
    try {
      const r = await fetch(API, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      const list = (await r.json()) || [];
      setHealth(true);
      state.jobs = list.map(norm).sort((a, b) => new Date(b.date) - new Date(a.date));
      for (const j of state.jobs) {
        const prev = state.prevStatus[j.id];
        if (j.status === "ok" && state.counts[j.id] == null) fetchCount(j);
        if (prev && prev !== j.status && j.status === "ok") notifyDone(j);
        if (prev && prev !== j.status && j.status === "failed") toast(`A busca “${j.name}” falhou.`);
        state.prevStatus[j.id] = j.status;
      }
      renderJobs();
      if (!state.booted) { state.booted = true; openFromHash(); }
    } catch {
      setHealth(false);
      if (!state.jobs.length) $("#jobs").innerHTML = `<p class="empty">Não consegui falar com o scraper.<br>Confira se o Docker Desktop está aberto.</p>`;
    }
  }

  // /#job=<id> opens that job directly (used by the Mapa ⇄ Painel switch).
  function openFromHash() {
    const m = location.hash.match(/job=([\w-]+)/);
    const job = m && state.jobs.find((j) => j.id === m[1] && j.status === "ok");
    if (job) openResults(job);
  }

  const rowsCache = {};
  async function fetchRows(id) {
    if (rowsCache[id]) return rowsCache[id];
    const r = await fetch(`${API}/${id}/download`, { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    const rows = parseCSV(await r.text());
    try { await Prospecting.enrichment(id, rows); } catch {}
    return (rowsCache[id] = rows);
  }

  async function fetchCount(j) {
    state.counts[j.id] = "…";
    try { state.counts[j.id] = (await fetchRows(j.id)).length; } catch { state.counts[j.id] = "?"; }
    renderJobs();
  }

  async function notifyDone(j) {
    try { toast(`“${j.name}” terminou: ${(await fetchRows(j.id)).length} resultados`, 6000); }
    catch { toast(`“${j.name}” terminou`); }
  }

  function renderJobs() {
    const box = $("#jobs");
    if (!state.jobs.length) {
      box.innerHTML = `<p class="empty">Nenhuma busca ainda. Faça a primeira acima.</p>`;
      renderJobs._last = null;
      return;
    }
    const html = state.jobs.map((j) => {
      const count = state.counts[j.id];
      const meta = [
        `<span class="status ${esc(j.status)}">${esc(STATUS[j.status] || j.status)}</span>`,
        `<span class="dot">${esc(ago(j.date))}</span>`,
        j.status === "ok" && count != null ? `<span class="dot">${esc(count)} lugares</span>` : "",
        j.email ? `<span class="dot">com e-mails</span>` : "",
      ].join("");
      return `<li class="job ${esc(j.status)}" data-id="${esc(j.id)}" ${j.status === "ok" ? 'tabindex="0" role="button" title="Ver resultados no mapa"' : ""}>
        <span class="job-icon">${j.status === "ok" ? ICON.list : ICON.search}</span>
        <div class="job-body">
          <div class="job-title">${esc(j.name || j.keywords.join(", "))}</div>
          <div class="job-meta">${meta}</div>
          ${j.status === "working" ? '<div class="progress" title="Coletando no Google Maps…"></div>' : ""}
        </div>
        <button class="job-del" data-act="delete" title="${j.status === "working" ? "Parar esta busca e apagá-la" : "Apagar esta busca e os resultados dela"}" aria-label="Apagar">${j.status === "working" ? ICON.stop : ICON.del}</button>
      </li>`;
    }).join("");
    // Only touch the DOM when something changed, so polling doesn't eat clicks/hover.
    if (html !== renderJobs._last) { box.innerHTML = html; renderJobs._last = html; }
  }

  async function deleteJob(job) {
    const msg = job.status === "working"
      ? `Parar a busca “${job.name}”? Ela será apagada e o que já foi coletado se perde.`
      : `Apagar a busca “${job.name}”? Os resultados somem daqui (arquivos já baixados continuam no seu computador).`;
    if (!confirm(msg)) return;
    const r = await fetch(`${API}/${job.id}`, { method: "DELETE" });
    if (!r.ok) return toast("Não consegui apagar essa busca.");
    delete rowsCache[job.id]; delete state.counts[job.id];
    toast("Busca apagada.");
    refreshJobs();
  }

  $("#jobs").addEventListener("click", (e) => {
    const li = e.target.closest(".job");
    const job = li && state.jobs.find((j) => j.id === li.dataset.id);
    if (!job) return;
    if (e.target.closest("[data-act=delete]")) return deleteJob(job);
    if (job.status === "ok") openResults(job);
  });
  $("#jobs").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const li = e.target.closest(".job.ok");
    const job = li && state.jobs.find((j) => j.id === li.dataset.id);
    if (job) openResults(job);
  });

  // ───────────────────────── form controls ─────────────────────────
  $$(".chip[data-depth]").forEach((c) => c.addEventListener("click", () => setDepth(+c.dataset.depth)));
  function setDepth(d) {
    state.depth = d;
    $$(".chip[data-depth]").forEach((c) => c.classList.toggle("selected", +c.dataset.depth === d));
    $("#amount-hint").textContent = AMOUNT_HINT[d];
  }
  function syncRadius(fit) {
    const km = +$("#radius").value;
    $("#radius-val").textContent = `${km} km`;
    $("#radius").style.setProperty("--fill-pct", `${((km - 1) / 19) * 100}%`);
    $("#radius-hint").textContent = state.geo ? "Área em volta do local, desenhada no mapa." : "Digite o local acima para ver a área no mapa.";
    if (state.geo && !state.current) drawArea(+state.geo.lat, +state.geo.lon, km * 1000, fit);
  }
  $("#radius").addEventListener("input", () => syncRadius(true));

  $("#email-chip").addEventListener("click", () => {
    state.email = !state.email;
    $("#email-chip").setAttribute("aria-pressed", state.email);
    $("#email-note").hidden = !state.email;
  });

  // ───────────────────────── geocoding ─────────────────────────
  // Prefer Brazil first ("Barra Funda" alone would otherwise land on the town in RS), then worldwide.
  const geoCache = load("geo2", {});
  async function nominatim(place, extra) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&accept-language=pt-BR${extra}&q=${encodeURIComponent(place)}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error("geocode " + r.status);
    return (await r.json())[0];
  }
  async function geocode(place) {
    const key = place.trim().toLowerCase();
    if (!key) return null;
    if (geoCache[key]) return geoCache[key];
    const hit = (await nominatim(place, "&countrycodes=br")) || (await nominatim(place, ""));
    if (!hit) return null;
    const a = hit.address || {};
    const uf = (a["ISO3166-2-lvl4"] || "").split("-")[1];
    const label = [a.suburb || a.neighbourhood || a.city_district || a.quarter, a.city || a.town || a.village || a.municipality,
      a.country_code === "br" ? uf || a.state : [a.state, a.country].filter(Boolean).join(", ")]
      .filter(Boolean).join(", ") || hit.display_name.split(",").slice(0, 3).join(",");
    const g = { lat: (+hit.lat).toFixed(6), lon: (+hit.lon).toFixed(6), label };
    geoCache[key] = g; store("geo2", geoCache);
    return g;
  }

  const GEO_HINT = 'Ex.: <em>dentista</em> em <em>Barra Funda, São Paulo</em>. Várias buscas? Separe por vírgula.';
  let geoTimer;
  async function checkLocation() {
    const place = $("#location").value.trim();
    const hint = $("#geo-status");
    state.geo = null;
    if (!place) { hint.className = "footnote"; hint.innerHTML = GEO_HINT; showLookup(null); return null; }
    hint.className = "footnote"; hint.textContent = "Localizando no mapa…";
    try {
      const g = await geocode(place);
      if ($("#location").value.trim() !== place) return null;   // user kept typing
      if (!g) { hint.className = "footnote warn"; hint.textContent = "Não achei esse lugar no mapa. A busca vai usar só o texto."; showLookup(null); return null; }
      state.geo = g;
      hint.className = "footnote ok";
      hint.textContent = "📍 " + g.label;
      showLookup(g);
      syncRadius(false);
      return g;
    } catch {
      hint.className = "footnote warn"; hint.textContent = "Sem acesso ao serviço de mapas agora. A busca vai usar só o texto.";
      return null;
    }
  }
  $("#location").addEventListener("input", () => { state.geo = null; clearTimeout(geoTimer); geoTimer = setTimeout(checkLocation, 700); });

  // ───────────────────────── submit ─────────────────────────
  function showError(msg) { const e = $("#form-error"); e.textContent = msg; e.hidden = !msg; }

  $("#search-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (state.submitting) return;                 // guards against double clicks
    showError("");
    const terms = $("#keyword").value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    const place = $("#location").value.trim();
    if (!terms.length) { $("#keyword").focus(); return showError("Diga o que você procura. Ex.: dentista."); }
    if (!place) { $("#location").focus(); return showError("Diga onde procurar. Ex.: Barra Funda, São Paulo."); }

    const lang = $("#lang").value, depth = state.depth, email = state.email;
    const keywords = terms.map((t) => `${t} ${JOINER[lang] || "em"} ${place}`);
    const dup = state.jobs.find((j) => (j.status === "pending" || j.status === "working") && j.keywords.join("|") === keywords.join("|"));
    if (dup && !confirm("Essa mesma busca já está rodando ou na fila. Criar outra igual mesmo assim?")) return;

    state.submitting = true;
    const btn = $("#submit"); btn.disabled = true; btn.querySelector(".btn-label").textContent = "Enviando…";
    try {
      const g = state.geo || await checkLocation();
      const autoSecs = Math.min(3600, Math.max(300, terms.length * (120 + depth * 40) * (email ? 2 : 1)));
      const maxMin = +$("#maxtime").value;
      const body = {
        name: `${terms.join(", ")} · ${place.split(",")[0].trim()}`,
        keywords, lang, depth, email,
        // lat/lon only bias the map viewport; the place is also in the keyword text,
        // so an un-geocodable place still works (the API just requires *some* coordinates).
        lat: g ? g.lat : "0", lon: g ? g.lon : "0",
        zoom: g ? zoomFor(radiusMeters(), +g.lat) : 14, radius: radiusMeters(),
        fast_mode: false, max_time: maxMin ? maxMin * 60 : autoSecs,
      };
      const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) {
        let msg = `O scraper recusou a busca (erro ${r.status}).`;
        try { const j = await r.json(); if (j.message) msg += ` ${j.message}`; } catch {}
        throw new Error(msg);
      }
      const busy = state.jobs.some((j) => j.status === "working" || j.status === "pending");
      toast(busy ? "Busca criada. Ela entra na fila depois da atual." : "Busca criada! Acompanhe em “Suas buscas”.");
      store("prefs", { lang, depth, radius: +$("#radius").value });
      $("#keyword").value = "";
      refreshJobs();
    } catch (err) {
      showError(err.message || "Não consegui criar a busca. O scraper está online?");
    } finally {
      state.submitting = false; btn.disabled = false;
      btn.querySelector(".btn-label").textContent = "Pesquisar";
    }
  });

  // ───────────────────────── results ─────────────────────────
  function insideShare(job, rows) {
    const located = rows.filter((r) => +r.latitude);
    if (!job.lat || !job.radius || !located.length) return 0;
    return located.filter((r) => distance(job.lat, job.lon, +r.latitude, +r.longitude) <= job.radius).length / located.length;
  }

  async function openResults(job) {
    state.current = job.id;
    history.replaceState(null, "", `#job=${job.id}`);
    $("#to-painel").href = `/painel#job=${job.id}`;
    $("#view-home").hidden = true; $("#view-results").hidden = false;
    $("#panel").scrollTop = 0;
    $("#results-title").textContent = job.name || "Resultados";
    $("#dash-title").textContent = job.name || "Painel";
    $("#results-sub").textContent = "Carregando…";
    $("#places").innerHTML = "";
    $("#raw-download").href = `${API}/${job.id}/download`;
    $("#raw-download").setAttribute("download", `${slug(job.name)}-completo.csv`);
    if (lookupMarker) lookupMarker.remove();
    try { state.rows = await fetchRows(job.id); }
    catch { $("#results-sub").textContent = "Não consegui baixar os resultados dessa busca."; return; }

    const cats = [...new Set(state.rows.map((r) => r.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const counts = Object.fromEntries(cats.map((c) => [c, state.rows.filter((r) => r.category === c).length]));
    $("#cat-filter").innerHTML = `<option value="">Todas as categorias</option>` + cats.map((c) => `<option value="${esc(c)}">${esc(c)} (${counts[c]})</option>`).join("");
    $("#filter").value = "";
    state.sort = { key: null, dir: 1 };
    setPressed("#sort-rating", false);
    const hasArea = !!(job.lat && job.radius);
    const share = insideShare(job, state.rows);
    $("#in-radius").hidden = !hasArea;
    $("#in-radius").textContent = hasArea ? `Dentro de ${Math.round(job.radius / 100) / 10} km` : "";
    setPressed("#in-radius", hasArea && share >= 0.5);
    if (hasArea && share < 0.5) toast("A maioria dos resultados ficou fora do raio: o local pode ter sido entendido diferente. Filtro de raio desligado.", 7000);
    const n = (f) => state.rows.filter(f).length;
    const sub = `${state.rows.length} lugares · ${n((r) => r.phone)} com telefone · ${n((r) => r.website)} com site` +
      (job.email ? ` · ${n((r) => emailsOf(r).length)} com e-mail` : "");
    $("#results-sub").textContent = sub;
    $("#dash-sub").textContent = `Busca: ${job.keywords.join(" / ")} · ${ago(job.date)}`;
    renderResults();
  }

  function closeResults() {
    state.current = null; state.rows = []; state.visible = [];
    history.replaceState(null, "", location.pathname);
    $("#to-painel").href = "/painel";
    $("#view-results").hidden = true; $("#view-home").hidden = false;
    $("#dash").hidden = true;
    if (hasMap) { markerLayer.clearLayers(); drawArea(); if (state.geo) showLookup(state.geo); }
  }
  $("#back").addEventListener("click", closeResults);

  const pressed = (s) => $(s).getAttribute("aria-pressed") === "true";
  function setPressed(s, v) { $(s).setAttribute("aria-pressed", v); $(s).classList.toggle("selected", v); }
  ["#in-radius", "#dedupe", "#only-phone", "#sort-rating"].forEach((s) => $(s).addEventListener("click", () => {
    setPressed(s, !pressed(s));
    if (s === "#sort-rating") state.sort = pressed(s) ? { key: "review_rating", dir: -1 } : { key: null, dir: 1 };
    renderResults();
  }));
  $("#filter").addEventListener("input", renderResults);
  $("#cat-filter").addEventListener("input", renderResults);

  function visibleRows() {
    const q = $("#filter").value.trim().toLowerCase();
    const cat = $("#cat-filter").value;
    const job = state.jobs.find((j) => j.id === state.current) || {};
    const area = pressed("#in-radius") && job.lat && job.radius;
    let rows = state.rows.filter((r) =>
      (!area || !+r.latitude || distance(job.lat, job.lon, +r.latitude, +r.longitude) <= job.radius) &&
      (!cat || r.category === cat) && (!pressed("#only-phone") || r.phone) &&
      (!q || [r.title, r.category, r.address, r.phone, r.website, r.emails].join(" ").toLowerCase().includes(q)));
    if (pressed("#dedupe")) {
      const seen = new Set();
      rows = rows.filter((r) => {
        const k = digits(r.phone) || r.place_id || r.link || r.title + r.address;
        if (seen.has(k)) return false;
        seen.add(k); return true;
      });
    }
    const { key, dir } = state.sort;
    if (key) {
      const numeric = key === "review_rating" || key === "review_count";
      rows = [...rows].sort((a, b) => numeric
        ? ((+a[key] || 0) - (+b[key] || 0) || (+a.review_count || 0) - (+b.review_count || 0)) * dir
        : String(a[key]).localeCompare(String(b[key]), "pt-BR") * dir);
    }
    return rows;
  }

  function renderResults() {
    const rows = (state.visible = visibleRows());
    $("#export-count").textContent = `${rows.length} de ${state.rows.length}`;
    $("#places").innerHTML = rows.length ? rows.map((r, i) => {
      const wa = whatsapp(r.phone);
      const rating = +r.review_rating;
      const mails = emailsOf(r);
      const route = +r.latitude ? `https://www.google.com/maps/dir/?api=1&destination=${r.latitude},${r.longitude}` : r.link;
      return `<li class="place" data-i="${i}">
        <div class="place-name">${esc(r.title)}</div>
        ${rating ? `<div class="rating"><b>${rating.toFixed(1).replace(".", ",")}</b>${starsHTML(rating)}<span>(${fmt(r.review_count)})</span></div>` : ""}
        <div class="place-line">${esc([r.category, r.address.replace(r.title + " - ", "")].filter(Boolean).join(" · "))}</div>
        ${r.phone ? `<div class="place-line phone">${esc(r.phone)}</div>` : ""}
        ${mails.length ? `<div class="place-line mail">${mails.map((m) => `<a href="mailto:${esc(m)}">${esc(m)}</a>`).join(", ")}</div>` : ""}
        <div class="place-actions">
          ${r.website ? `<a class="act" href="${esc(r.website)}" target="_blank" rel="noopener">${ICON.web}Site</a>` : ""}
          ${wa ? `<a class="act wa" href="${wa}" target="_blank" rel="noopener">${ICON.wa}WhatsApp</a>` : r.phone ? `<a class="act" href="tel:${esc(digits(r.phone))}">${ICON.phone}Ligar</a>` : ""}
          ${route ? `<a class="act" href="${esc(route)}" target="_blank" rel="noopener">${ICON.dir}Rotas</a>` : ""}
          ${r.link ? `<a class="act" href="${esc(r.link)}" target="_blank" rel="noopener">Ver no Maps</a>` : ""}
        </div>
      </li>`;
    }).join("") : `<li class="empty">Nada com esses filtros.</li>`;
    plotRows(rows);
    const job = state.jobs.find((j) => j.id === state.current) || {};
    if (job.lat && job.radius) drawArea(job.lat, job.lon, job.radius, false);
    if (!$("#dash").hidden) renderDash();
  }

  $("#places").addEventListener("mouseover", (e) => {
    const li = e.target.closest(".place");
    if (li && hasMap && markers[li.dataset.i]) markers[li.dataset.i].setIcon(pinIcon("#ea4335", true));
  });
  $("#places").addEventListener("mouseout", (e) => {
    const li = e.target.closest(".place");
    if (li && hasMap && markers[li.dataset.i] && !li.classList.contains("hl")) markers[li.dataset.i].setIcon(pinIcon("#ea4335"));
  });
  $("#places").addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    const li = e.target.closest(".place");
    if (!li) return;
    const i = +li.dataset.i, m = hasMap && markers[i];
    highlight(i, false);
    if (m) { focusPoint(m.getLatLng(), Math.max(map.getZoom(), 16)); setTimeout(() => m.openPopup(), 700); }
  });

  // ───────────────────────── dashboard ("Painel") ─────────────────────────
  // Everything here reflects the current filters, so the side panel and the dashboard always agree.
  function renderDash() {
    const rows = state.visible;
    const job = state.jobs.find((j) => j.id === state.current) || {};
    const n = (f) => rows.filter(f).length;
    const total = rows.length;
    const phone = n((r) => r.phone), wa = n((r) => whatsapp(r.phone)), site = n((r) => r.website), mail = n((r) => emailsOf(r).length);
    const rated = rows.filter((r) => +r.review_rating);
    const avg = rated.length ? rated.reduce((a, r) => a + +r.review_rating, 0) / rated.length : 0;
    const reviews = rows.reduce((a, r) => a + (+r.review_count || 0), 0);

    const kpis = [
      ["Empresas", fmt(total), total < state.rows.length ? `de ${fmt(state.rows.length)} (com filtros)` : "todas desta busca"],
      ["Com telefone", fmt(phone), `${pct(phone, total)}% das empresas`],
      ["Com WhatsApp", fmt(wa), "celulares (dá para chamar direto)"],
      ["Com site", fmt(site), `${pct(site, total)}% das empresas`],
      job.email ? ["Com e-mail", fmt(mail), `${pct(mail, total)}% (achados nos sites)`] : ["E-mails", "—", "busca feita sem e-mail"],
      ["Nota média", avg ? avg.toFixed(1).replace(".", ",") + " ★" : "—", `${fmt(reviews)} avaliações no total`],
    ];
    $("#dash-kpis").innerHTML = kpis.map(([l, v, h]) => `<div class="kpi"><span class="kpi-label">${esc(l)}</span><span class="kpi-value">${esc(v)}</span><span class="kpi-hint">${esc(h)}</span></div>`).join("");

    // Categories: computed over all rows (not the category filter) so you can switch between them.
    const base = state.rows;
    const byCat = {};
    base.forEach((r) => { const c = r.category || "Sem categoria"; byCat[c] = (byCat[c] || 0) + 1; });
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const max = cats.length ? cats[0][1] : 1;
    const active = $("#cat-filter").value;
    $("#dash-cats").innerHTML = cats.map(([c, v]) => `<li class="bar clickable ${c === active ? "on" : ""}" data-cat="${esc(c)}" title="Filtrar por ${esc(c)}">
      <span class="bar-name">${esc(c)}</span><span class="bar-val">${fmt(v)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${(v / max) * 100}%"></span></span></li>`).join("") +
      (active ? `<li class="bar clickable" data-cat=""><span class="bar-name" style="color:var(--blue)">✕ Mostrar todas as categorias</span></li>` : "");

    const contacts = [
      ["Telefone", phone, "green"], ["WhatsApp (celular)", wa, "green"], ["Site", site, ""],
      ...(job.email ? [["E-mail", mail, "yellow"]] : []), ["Sem nenhum contato", n((r) => !r.phone && !r.website && !emailsOf(r).length), "red"],
    ];
    $("#dash-contacts").innerHTML = contacts.map(([l, v, cls]) => `<li class="bar ${cls}">
      <span class="bar-name">${esc(l)}</span><span class="bar-val">${pct(v, total)}%</span>
      <span class="bar-track"><span class="bar-fill" style="width:${pct(v, total)}%"></span></span></li>`).join("");

    $("#dash-count").textContent = `${fmt(total)} empresas na tabela`;
    $$("#results-table th[data-sort]").forEach((th) => {
      th.classList.toggle("sorted-asc", th.dataset.sort === state.sort.key && state.sort.dir === 1);
      th.classList.toggle("sorted-desc", th.dataset.sort === state.sort.key && state.sort.dir === -1);
    });
    $("#results-table tbody").innerHTML = rows.length ? rows.map((r) => `<tr>
      <td>${r.link ? `<a href="${esc(r.link)}" target="_blank" rel="noopener">${esc(r.title)}</a>` : esc(r.title)}</td>
      <td>${esc(r.category)}</td>
      <td style="white-space:nowrap">${esc(r.phone)}${whatsapp(r.phone) ? ` <a href="${whatsapp(r.phone)}" target="_blank" rel="noopener" title="Abrir no WhatsApp" style="color:var(--green)">WA</a>` : ""}</td>
      <td>${emailsOf(r).map((m) => `<a href="mailto:${esc(m)}">${esc(m)}</a>`).join("<br>")}</td>
      <td>${r.website ? `<a href="${esc(r.website)}" target="_blank" rel="noopener">${esc(r.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").slice(0, 36))}</a>` : ""}</td>
      <td class="num">${+r.review_rating ? (+r.review_rating).toFixed(1).replace(".", ",") : "—"}</td>
      <td class="num">${r.review_count ? fmt(r.review_count) : "—"}</td>
      <td>${esc(r.address)}</td>
    </tr>`).join("") : `<tr><td colspan="8" class="empty">Nenhuma empresa com esses filtros.</td></tr>`;
  }

  $("#open-dash").addEventListener("click", () => { $("#dash").hidden = false; renderDash(); });
  $("#dash-close").addEventListener("click", () => ($("#dash").hidden = true));
  $("#dash").addEventListener("click", (e) => { if (e.target.id === "dash") $("#dash").hidden = true; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#dash").hidden = true; });
  $("#dash-cats").addEventListener("click", (e) => {
    const li = e.target.closest("[data-cat]");
    if (!li) return;
    $("#cat-filter").value = li.dataset.cat === $("#cat-filter").value ? "" : li.dataset.cat;
    renderResults();
  });
  $("#results-table thead").addEventListener("click", (e) => {
    const th = e.target.closest("th[data-sort]");
    if (!th) return;
    const key = th.dataset.sort;
    state.sort = state.sort.key === key ? { key, dir: -state.sort.dir } : { key, dir: key.startsWith("review") ? -1 : 1 };
    setPressed("#sort-rating", key === "review_rating" && state.sort.dir === -1);
    renderResults();
  });

  // ───────────────────────── export ─────────────────────────
  const EXPORT_HEAD = ["Nome", "Categoria", "Telefone", "WhatsApp", "E-mail", "Site", "Nota", "Avaliações", "Endereço", "Link Google Maps"];
  const exportRow = (r) => [
    r.title, r.category, r.phone, whatsapp(r.phone) || "", emailsOf(r).join(", "), r.website,
    +r.review_rating ? (+r.review_rating).toFixed(1).replace(".", ",") : "", r.review_count, r.address, r.link,
  ];

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-export]");
    if (!btn) return;
    const rows = state.visible.map(exportRow);
    const job = state.jobs.find((j) => j.id === state.current);
    const base = slug(job ? job.name : "resultados");
    const kind = btn.dataset.export;
    if (kind === "excel") {
      // Excel pt-BR expects ';' as separator; the BOM makes it read UTF-8 accents correctly.
      saveFile(`${base}.csv`, "﻿" + toCSV(EXPORT_HEAD, rows, ";"), "text/csv;charset=utf-8");
      toast(`${rows.length} empresas baixadas. Dê dois cliques no arquivo para abrir no Excel.`);
    } else if (kind === "sheets") {
      saveFile(`${base}-sheets.csv`, "﻿" + toCSV(EXPORT_HEAD, rows, ","), "text/csv;charset=utf-8");
      toast("Baixado. No Google Sheets: Arquivo → Importar → Upload.", 6000);
    } else if (kind === "copy") {
      const tsv = [EXPORT_HEAD, ...rows].map((r) => r.map((v) => String(v ?? "").replace(/[\t\r\n]+/g, " ")).join("\t")).join("\n");
      try { await navigator.clipboard.writeText(tsv); toast(`${rows.length} linhas copiadas. Cole (Ctrl+V) no Sheets ou Excel.`); }
      catch { toast("O navegador bloqueou a cópia. Use os botões de download."); }
    }
  });

  // ───────────────────────── keyboard ─────────────────────────
  $("#keyword").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !$("#location").value.trim()) { e.preventDefault(); $("#location").focus(); }
  });
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (e.key === "/" && !typing) {
      e.preventDefault();
      if (!$("#view-results").hidden) $("#filter").focus(); else $("#keyword").focus();
    }
  });

  // ───────────────────────── boot ─────────────────────────
  const prefs = load("prefs", {});
  if (prefs.lang) $("#lang").value = prefs.lang;
  setDepth(prefs.depth || 5);
  if (prefs.radius) $("#radius").value = prefs.radius;
  syncRadius(false);
  Prospecting.locationDefault(g=>{state.geo=g;if(!state.current){showLookup(g);syncRadius(false);}});
  refreshJobs();
  setInterval(refreshJobs, POLL_MS);
  setInterval(() => { renderJobs._last = null; renderJobs(); }, 30000);  // keep "há X min" fresh
})();
