const ELEM_COLORS = {
  Anemo: "#66c8b0", Geo: "#e0b34a", Electro: "#b58cf0",
  Dendro: "#86cf84", Hydro: "#5cb8e8", Pyro: "#f07a55",
  Cryo: "#8fd6ec", Mystery: "#ef9fc8",
};
const IMG_LABEL = { charIngame: "Karakter in-game", profile: "Foto profil (AM)", selfie: "Selfie" };

let CFG = null;
let REGIONS = [];
const regionsById = {};
let activeTab = null;
let charCount = 0;

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const [c, r] = await Promise.all([fetch("/api/config").then((x) => x.json()), fetch("/api/regions").then((x) => x.json())]);
    CFG = c;
    REGIONS = r.regions || [];
    REGIONS.forEach((reg) => { regionsById[reg.id] = reg; });
  } catch (e) { console.error(e); }
  renderHero();
  renderShowcase();
  renderGlobalFields();
  addCharBlock();
  bindForm();
  loadGallery();
  bindModalClose();
  bindLightbox();
}

/* ---------- Hero ---------- */
function renderHero() {
  if (CFG && CFG.siteTitle) $("site-title").textContent = CFG.siteTitle;
  if (CFG && CFG.siteTagline) $("site-tagline").textContent = CFG.siteTagline;
}

/* ---------- Theme toolbox ---------- */
function elColor(e) { return ELEM_COLORS[e] || "#9aa3bd"; }
function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return `rgba(154,163,189,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ---------- Showcase ---------- */
function renderShowcase() {
  const tabs = $("region-tabs");
  tabs.innerHTML = "";
  REGIONS.forEach((reg) => {
    const b = document.createElement("button");
    b.className = "region-tab" + (activeTab === reg.id ? " active" : "");
    b.innerHTML = `<span class="emblem" style="background:${elColor(reg.emblem)}"></span> ${reg.name}`;
    b.addEventListener("click", () => { activeTab = reg.id; renderTabs(); renderGrid(); });
    tabs.appendChild(b);
  });
  if (!activeTab && REGIONS.length) activeTab = REGIONS[0].id;
  renderGrid();
}
function renderTabs() {
  [...$("region-tabs").children].forEach((b) => {
    const name = b.textContent.trim().split(" ").slice(1).join(" ");
    const reg = REGIONS.find((r) => r.name === name);
    b.classList.toggle("active", reg && reg.id === activeTab);
  });
}
function renderGrid() {
  const grid = $("char-grid");
  grid.innerHTML = "";
  const reg = regionsById[activeTab];
  if (!reg) return;
  reg.characters.forEach((ch) => {
    const cell = document.createElement("div");
    cell.className = "char-cell";
    cell.innerHTML = `<div class="char-ava" style="border-color:${hexA(elColor(reg.emblem),0.55)}"><img src="${ch.img}" alt="${ch.name}"></div><div class="cname">${ch.name}</div>`;
    cell.addEventListener("click", () => openCharModal(ch, reg));
    grid.appendChild(cell);
  });
}
function openCharModal(ch, reg) {
  const body = $("char-modal").querySelector(".modal-body");
  body.innerHTML = `
    <img class="mc-portrait" src="${ch.img}" alt="${ch.name}" style="border-color:${hexA(elColor(reg.emblem),0.6)}">
    <h3>${ch.name}</h3>
    <div class="mtitle">${ch.title || ""}</div>
    <div class="chips">
      <span class="chip dim">⭐ ${ch.rarity || ""}</span>
      <span class="chip" style="background:${hexA(elColor(ch.element),0.18)};border-color:${hexA(elColor(ch.element),0.5)}">${ch.element}</span>
      <span class="chip">${ch.weapon}</span>
      <span class="chip">${reg.name}</span>
    </div>
    <p class="desc">${ch.desc || ""}</p>
    ${ch.affiliation ? `<p class="affil"><b>Afiliasi:</b> ${ch.affiliation}</p>` : ""}`;
  $("char-modal").hidden = false;
}

/* ---------- Form ---------- */
function renderGlobalFields() {
  const wrap = $("global-fields");
  wrap.innerHTML = "";
  const f = (CFG && CFG.fields) || {};
  const items = [
    ["name", "input", "text"],
    ["social", "input", "text"],
    ["note", "textarea", ""],
  ];
  items.forEach(([key, tag, type]) => {
    if (!f[key] || f[key].enabled === false) return;
    const cfg = f[key];
    const req = cfg.required ? '<span class="req">*</span>' : "";
    wrap.insertAdjacentHTML("beforeend",
      `<label>${cfg.label} ${req}
        ${tag === "textarea"
          ? `<textarea name="${key}" rows="3" ${req ? "required" : ""}></textarea>`
          : `<input type="${type}" name="${key}" ${req ? "required" : ""}>`}
      </label>`);
  });
}
function addCharBlock() {
  const max = (CFG && CFG.maxCharacters) || 3;
  if (charCount >= max) return;
  const blocks = $("char-blocks");
  const i = charCount;
  const card = document.createElement("div");
  card.className = "char-block";
  card.dataset.idx = i;
  card.innerHTML = `
    <div class="block-title">
      <span>Karakter ${i + 1}</span>
      ${charCount > 0 ? '<button type="button" class="remove-char">Hapus</button>' : ""}
    </div>
    <label>Region <span class="req">*</span>
      <select name="region_${i}" class="region-sel" required>
        <option value="">-- pilih region --</option>
      </select>
    </label>
    <input type="hidden" name="element_${i}" class="element-hid">
    <label>Karakter <span class="req">*</span>
      <select name="character_${i}" class="char-sel" required>
        <option value="">-- pilih region dulu --</option>
      </select>
    </label>
    <div class="affinity-fields-${i}"></div>
    <div class="img-fields-${i}"></div>
  `;
  const imgWrap = card.querySelector(`.img-fields-${i}`);
  buildImgFields(imgWrap, i, card);
  blocks.appendChild(card);
  charCount++;

  const regionSel = card.querySelector(".region-sel");
  REGIONS.forEach((reg) => {
    const o = document.createElement("option");
    o.value = reg.id;
    o.textContent = reg.name;
    regionSel.appendChild(o);
  });
  regionSel.addEventListener("change", () => {
    populateChars(card, i);
    $(`add-char-btn`).scrollIntoView({ block: "nearest", behavior: "smooth" });
  });

  // tombol remove
  card.addEventListener("click", (ev) => {
    if (ev.target.classList.contains("remove-char")) {
      card.remove();
      reindex();
    }
  });

  if (REGIONS.length) regionSel.value = REGIONS[0].id;
  populateChars(card, i);
  toggleAddBtn();
}
function buildImgFields(wrap, i, card) {
  const f = (CFG && CFG.fields) || {};
  if (f.affinity && f.affinity.enabled !== false) {
    const req = f.affinity.required ? '<span class="req">*</span>' : "";
    card.querySelector(`.affinity-fields-${i}`).insertAdjacentHTML("beforeend",
      `<label>${f.affinity.label} ${req}
        <input type="text" name="affinity_${i}" ${req ? "required" : ""} placeholder="contoh: Pyro / Hydro / Keqing">
      </label>`);
  }
  const types = ["charIngame", "profile", "selfie"];
  types.forEach((t) => {
    if (!f[t] || f[t].enabled === false) return;
    const req = f[t].required ? '<span class="req">*</span>' : "";
    const mult = f[t].multiple ? " multiple" : "";
    wrap.insertAdjacentHTML("beforeend",
      `<label>${f[t].label} ${req}
        <input type="file" name="imgs_${i}__${t}" accept="image/*"${mult} ${req ? "required" : ""}>
      </label>`);
  });
}
function populateChars(card, i) {
  const regId = card.querySelector(".region-sel").value || REGIONS[0].id;
  const reg = regionsById[regId];
  const charSel = card.querySelector(".char-sel");
  const hid = card.querySelector(".element-hid");
  charSel.innerHTML = '<option value="">-- pilih karakter --</option>';
  if (reg) {
    reg.characters.forEach((c) => {
      const o = document.createElement("option");
      o.value = c.name;
      o.textContent = c.name;
      charSel.appendChild(o);
    });
    hid.value = reg.emblem || "";
  } else {
    hid.value = "";
  }
  // afinitas (elemen karakter) => biarkan user isi; default dari emblem region
}
function reindex() {
  const cards = [...$("char-blocks").children];
  cards.forEach((card, idx) => {
    card.dataset.idx = idx;
    card.querySelector(".block-title span").textContent = "Karakter " + (idx + 1);
    card.querySelector(".region-sel").name = `region_${idx}`;
    card.querySelector(".element-hid").name = `element_${idx}`;
    card.querySelector(".char-sel").name = `character_${idx}`;
    card.querySelectorAll("input[type=file]").forEach((inp) => {
      inp.name = `imgs_${idx}__` + inp.name.split("__").pop();
    });
    const aff = card.querySelector("input[name^='affinity']");
    if (aff) aff.name = `affinity_${idx}`;
  });
  charCount = cards.length;
  toggleAddBtn();
}
function toggleAddBtn() {
  const max = (CFG && CFG.maxCharacters) || 3;
  $("add-char-btn").hidden = charCount >= max;
}
$("add-char-btn").addEventListener("click", addCharBlock);

function bindForm() {
  $("collab-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const btn = $("submit-btn");
    const err = $("form-error");
    err.hidden = true;
    btn.disabled = true;
    btn.textContent = "Mengirim...";

    const fd = new FormData();
    fd.append("name", $("collab-form").querySelector('[name="name"]').value.trim());
    const globalNote = $("collab-form").querySelector('[name="social"]');
    if (globalNote) fd.append("social", globalNote.value.trim());
    const globalNote2 = $("collab-form").querySelector('[name="note"]');
    if (globalNote2) fd.append("note", globalNote2.value.trim());

    const cards = [...$("char-blocks").children];
    fd.append("charCount", cards.length);
    cards.forEach((card, idx) => {
      fd.append(`region_${idx}`, card.querySelector(".region-sel").value);
      fd.append(`element_${idx}`, card.querySelector(".element-hid").value || "");
      fd.append(`character_${idx}`, card.querySelector(".char-sel").value);
      const aff = card.querySelector("input[name^='affinity']");
      if (aff) fd.append(`affinity_${idx}`, aff.value.trim());
      card.querySelectorAll("input[type=file]").forEach((inp) => {
        [...inp.files].forEach((f) => fd.append(inp.name, f));
      });
    });

    try {
      const res = await fetch("/api/submit", { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok) {
        err.style.color = "var(--ok)";
        err.textContent = "✅ Berhasil dikirim! Terima kasih sudah ikut collab.";
        err.hidden = false;
        $("collab-form").reset();
        reindex();
        loadGallery();
      } else {
        err.style.color = "var(--err)";
        err.textContent = "❌ " + (data.error || "Gagal mengirim");
        err.hidden = false;
      }
    } catch (e) {
      err.style.color = "var(--err)";
      err.textContent = "❌ Gagal mengirim. Coba lagi.";
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = "Kirim 🚀";
    }
  });
}

/* ---------- Gallery ---------- */
async function loadGallery() {
  const gal = $("gallery");
  try {
    const list = await fetch("/api/submissions").then((x) => x.json());
    gal.innerHTML = "";
    const filter = $("gallery-filter");
    filter.innerHTML = "";
    if (!list.length) {
      gal.innerHTML = '<p class="loading">Belum ada yang daftar. Jadilah yang pertama! ✨</p>';
      return;
    }
    // region filter chips
    const regionsUsed = new Set();
    list.forEach((e) => e.characters.forEach((c) => c.region && regionsUsed.add(c.region)));
    let active = "all";
    const mk = (val, label) => {
      const c = document.createElement("button");
      c.className = "rf-chip" + (active === val ? " active" : "");
      c.textContent = label;
      c.addEventListener("click", () => {
        active = val;
        filter.querySelectorAll(".rf-chip").forEach((x) => x.classList.remove("active"));
        c.classList.add("active");
        renderEntries(list, regionsUsed, val);
      });
      filter.appendChild(c);
    };
    mk("all", "Semua");
    [...regionsUsed].forEach((rid) => { const r = regionsById[rid]; mk(rid, r ? r.name : rid); });
    renderEntries(list, regionsUsed, active);
  } catch {
    gal.innerHTML = '<p class="loading">Gagal memuat daftar.</p>';
  }
}
function renderEntries(list, regionsUsed, active) {
  const gal = $("gallery");
  gal.innerHTML = "";
  list.forEach((e) => {
    if (active !== "all" && !e.characters.some((c) => c.region === active)) return;
    gal.appendChild(entryEl(e));
  });
  if (!gal.children.length) gal.innerHTML = '<p class="loading">Tidak ada untuk filter ini.</p>';
}
function entryEl(e) {
  const div = document.createElement("div");
  div.className = "entry";
  const who = e.name || "Anonim";
  const when = e.createdAt ? new Date(e.createdAt).toLocaleString("id-ID") : "";
  let bio = e.social ? "📎 " + e.social : "";
  let html = `
    <div class="entry-top">
      <span class="who">${who}</span>
      <span class="when">${when}</span>
    </div>
    ${bio ? `<div class="bio">${bio}</div>` : ""}
    ${e.note ? `<div class="entry-note">"${e.note}"</div>` : ""}`;
  e.characters.forEach((c) => {
    const color = elColor(c.element);
    html += `
      <div class="charcard">
        <div class="cc-head">
          <span class="elem-dot" style="background:${color}"></span> ${c.character}
          <span class="region-tag" style="background:${hexA(color,0.18)};border:1px solid ${hexA(color,0.5)}">${c.regionName || c.region}</span>
        </div>
        ${c.affinity ? `<div class="bio">Afinitas: <b>${c.affinity}</b></div>` : ""}
        <div class="imgs">
          ${(c.images || []).map((im) => `
            <div class="imgbox" data-src="${im.src}">
              <img src="${im.src}" alt="${im.type}">
              <span class="imglabel">${IMG_LABEL[im.type] || im.type}</span>
            </div>`).join("")}
        </div>
      </div>`;
  });
  div.innerHTML = html;
  div.querySelectorAll(".imgbox").forEach((b) => {
    b.addEventListener("click", () => openLightbox(b.dataset.src));
  });
  return div;
}

/* ---------- Modals & lightbox ---------- */
function bindModalClose() {
  $("modal-close").addEventListener("click", () => { $("char-modal").hidden = true; });
  $("char-modal").addEventListener("click", (e) => { if (e.target === $("char-modal")) $("char-modal").hidden = true; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { $("char-modal").hidden = true; $("lightbox").hidden = true; } });
}
function bindLightbox() {
  $("lb-close").addEventListener("click", () => { $("lightbox").hidden = true; });
  $("lightbox").addEventListener("click", (e) => { if (e.target === $("lightbox")) $("lightbox").hidden = true; });
}
function openLightbox(src) {
  $("lb-img").src = src;
  $("lightbox").hidden = false;
}
