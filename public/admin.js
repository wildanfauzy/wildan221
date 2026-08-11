const $ = (id) => document.getElementById(id);
const IMG_LABEL = { charIngame: "Karakter in-game", profile: "Foto profil (AM)", selfie: "Selfie" };

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    await fetch("/api/admin/me").then((r) => { if (!r.ok) throw 0; });
    showAdmin();
  } catch {
    $("login-view").hidden = false;
    bindLogin();
  }
}

function bindLogin() {
  $("login-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const err = $("login-err");
    err.hidden = true;
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: $("login-user").value, password: $("login-pass").value }),
    });
    const data = await res.json();
    if (data.ok) {
      showAdmin();
    } else {
      err.textContent = "❌ " + (data.error || "Login gagal");
      err.hidden = false;
    }
  });
  $("logout-btn").addEventListener("click", async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    location.reload();
  });
}

async function showAdmin() {
  $("login-view").hidden = true;
  $("admin-view").hidden = false;
  bindLightbox();
  await loadEntries();
}

async function loadEntries() {
  const wrap = $("entries");
  try {
    const list = await fetch("/api/admin/entries").then((r) => { if (!r.ok) throw 0; return r.json(); });
    $("count").textContent = list.length + " peserta ikut collab.";
    wrap.innerHTML = "";
    if (!list.length) { wrap.innerHTML = '<p class="loading">Belum ada yang daftar.</p>'; return; }
    list.forEach((e) => wrap.appendChild(entryRow(e)));
  } catch {
    wrap.innerHTML = '<p class="loading">Gagal memuat. Muat ulang halaman.</p>';
  }
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

function entryRow(e) {
  const div = document.createElement("div");
  div.className = "entry admin";
  div.appendChild(viewBody(e, null));
  return div;
}

function viewBody(e, cb) {
  const box = document.createElement("div");
  const when = e.createdAt ? new Date(e.createdAt).toLocaleString("id-ID") : "";
  let html = `
    <div class="entry-top">
      <span class="who">${esc(e.name)}</span>
      <span class="when">${when}</span>
    </div>
    ${e.social ? `<div class="bio">📎 ${esc(e.social)}</div>` : ""}
    ${e.note ? `<div class="entry-note">"${esc(e.note)}"</div>` : ""}`;
  e.characters.forEach((c) => {
    html += `
      <div class="charcard">
        <div class="cc-head">
          <span class="elem-dot" style="background:${elColor(c.element)}"></span> ${esc(c.character)}
          <span class="region-tag">${esc(c.regionName || c.region)}</span>
        </div>
        ${c.affinity ? `<div class="bio">Afinitas: <b>${esc(c.affinity)}</b></div>` : ""}
        <div class="imgs">
          ${(c.images || []).map((im) => `
            <div class="imgbox" data-src="${esc(im.src)}">
              <img src="${esc(im.src)}" alt="${esc(im.type)}">
              <span class="imglabel">${IMG_LABEL[im.type] || esc(im.type)}</span>
            </div>`).join("")}
        </div>
      </div>`;
  });
  html += `
    <div class="admin-actions">
      <button class="btn-edit" data-act="edit">✏️ Edit</button>
      <button class="btn-del" data-act="del">🗑 Hapus</button>
    </div>`;
  box.innerHTML = html;
  box.querySelectorAll(".imgbox").forEach((b) => b.addEventListener("click", () => openLightbox(b.dataset.src)));
  box.querySelector('[data-act="del"]').addEventListener("click", async () => {
    if (!confirm("Hapus peserta " + e.name + " beserta fotonya?")) return;
    await fetch("/api/admin/entries/" + e.id, { method: "DELETE" });
    location.reload();
  });
  box.querySelector('[data-act="edit"]').addEventListener("click", () => startEdit(box, e));
  return box;
}

function startEdit(box, e) {
  const form = document.createElement("div");
  form.className = "edit-form";
  let charHtml = "";
  e.characters.forEach((c, i) => {
    charHtml += `
      <div class="edit-charcard">
        <label>Karakter ${i + 1} — Region
          <input type="text" data-k="region" value="${esc(c.region)}">
        </label>
        <label>Nama Karakter
          <input type="text" data-k="character" value="${esc(c.character)}">
        </label>
        <label>Elemen
          <input type="text" data-k="element" value="${esc(c.element)}">
        </label>
        <label>Afinitas
          <input type="text" data-k="affinity" value="${esc(c.affinity)}">
        </label>
        <div class="imgs-edit">
          ${(c.images || []).map((im) => `<img src="${esc(im.src)}" title="${IMG_LABEL[im.type] || ''}">`).join("")}
        </div>
      </div>`;
  });
  form.innerHTML = `
    <label>Nama <input type="text" data-g="name" value="${esc(e.name)}"></label>
    <label>Akun sosial <input type="text" data-g="social" value="${esc(e.social)}"></label>
    <label>Catatan <textarea data-g="note" rows="2">${esc(e.note)}</textarea></label>
    ${charHtml}
    <div class="admin-actions">
      <button class="btn-save" id="save">💾 Simpan</button>
      <button class="btn-cancel" id="cancel">Batal</button>
    </div>`;
  box.innerHTML = "";
  box.appendChild(form);
  form.querySelector("#cancel").addEventListener("click", () => { box.innerHTML = ""; box.appendChild(viewBody(e)); });
  form.querySelector("#save").addEventListener("click", async () => {
    const payload = {
      name: form.querySelector('[data-g="name"]').value,
      social: form.querySelector('[data-g="social"]').value,
      note: form.querySelector('[data-g="note"]').value,
      characters: e.characters.map((c, i) => ({
        region: form.querySelectorAll('[data-k="region"]')[i].value,
        element: form.querySelectorAll('[data-k="element"]')[i].value,
        character: form.querySelectorAll('[data-k="character"]')[i].value,
        affinity: form.querySelectorAll('[data-k="affinity"]')[i].value,
        images: c.images,
      })),
    };
    const res = await fetch("/api/admin/entries/" + e.id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.ok) { box.innerHTML = ""; box.appendChild(viewBody(data.entry)); }
    else alert("Gagal simpan: " + (data.error || "unknown"));
  });
}

function elColor(e) {
  const m = { Anemo: "#66c8b0", Geo: "#e0b34a", Electro: "#b58cf0", Dendro: "#86cf84", Hydro: "#5cb8e8", Pyro: "#f07a55", Cryo: "#8fd6ec", Mystery: "#ef9fc8" };
  return m[e] || "#9aa3bd";
}

function bindLightbox() {
  $("lb-close").addEventListener("click", () => { $("lightbox").hidden = true; });
  $("lightbox").addEventListener("click", (ev) => { if (ev.target === $("lightbox")) $("lightbox").hidden = true; });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") $("lightbox").hidden = true; });
}
function openLightbox(src) {
  $("lb-img").src = src;
  $("lightbox").hidden = false;
}
