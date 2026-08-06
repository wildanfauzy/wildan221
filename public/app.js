const regions = {};
const emblems = {};
let charSelect, regionSelect, galaxyElement, form, gallery, submitBtn;

document.addEventListener("DOMContentLoaded", async () => {
  regionSelect = document.getElementById("region");
  charSelect = document.getElementById("character");
  galaxyElement = document.getElementById("element");
  form = document.getElementById("collab-form");
  gallery = document.getElementById("gallery");
  submitBtn = document.getElementById("submit-btn");

  try {
    const res = await fetch("/api/regions");
    const data = await res.json();
    data.regions.forEach((r) => {
      regions[r.id] = r.characters || [];
      emblems[r.id] = r.emblem || "";
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.name + " (" + r.emblem + ")";
      regionSelect.appendChild(opt);
    });
  } catch (e) {
    console.error("Gagal load region", e);
  }

  regionSelect.addEventListener("change", () => {
    charSelect.innerHTML = '<option value="">-- pilih karakter --</option>';
    galaxyElement.value = emblems[regionSelect.value] || "";
    (regions[regionSelect.value] || []).forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      charSelect.appendChild(opt);
    });
  });

  form.addEventListener("submit", () => {
    submitBtn.disabled = true;
    submitBtn.textContent = "Mengirim...";
  });

  loadGallery();
});

function showImg(src, alt) {
  if (!src) return "";
  return '<div class="imgbox"><span class="imglabel">' + alt + '</span><img src="' + src + '" alt="' + alt + '"></div>';
}

async function loadGallery() {
  try {
    const res = await fetch("/api/submissions");
    const list = await res.json();
    gallery.innerHTML = "";
    if (!list.length) {
      gallery.innerHTML = '<p class="loading">Belum ada yang daftar. Jadilah yang pertama! ✨</p>';
      return;
    }
    list.slice().reverse().forEach((e) => {
      const div = document.createElement("div");
      div.className = "entry";
      div.innerHTML =
        '<div class="char">' + e.character + " (" + (e.element || "?") + ")" + "</div>" +
        '<div class="meta">' + (e.name || "Anonim") +
        (e.social ? " · " + e.social : "") + "</div>" +
        (e.affinity ? '<div class="meta">Afinitas: <b>' + e.affinity + "</b></div>" : "") +
        '<span class="tag">' + e.region + "</span>" +
        '<div class="imgs">' +
        showImg(e.charImg, "Char in-game") +
        showImg(e.profileImg, "Foto profil (AM)") +
        showImg(e.selfie, "Selfie") +
        "</div>" +
        (e.note ? '<div class="meta note">"' + e.note + '"</div>' : "");
      gallery.appendChild(div);
    });
  } catch (e) {
    gallery.innerHTML = '<p class="loading">Gagal memuat daftar.</p>';
  }
}