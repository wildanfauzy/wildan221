const regions = {};
let charSelect, regionSelect, form, gallery, submitBtn;

document.addEventListener("DOMContentLoaded", async () => {
  regionSelect = document.getElementById("region");
  charSelect = document.getElementById("character");
  form = document.getElementById("collab-form");
  gallery = document.getElementById("gallery");
  submitBtn = document.getElementById("submit-btn");

  try {
    const res = await fetch("/api/regions");
    const data = await res.json();
    data.regions.forEach((r) => {
      regions[r.id] = r.characters || [];
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
        (e.image
          ? '<img src="' + e.image + '" alt="' + e.character + '">'
          : '<div class="info" style="height:100px"></div>') +
        '<div class="info">' +
        '<div class="char">' + e.character + "</div>" +
        '<div class="meta">' + (e.name || "Anonim") +
        (e.social ? " · " + e.social : "") + "</div>" +
        (e.note ? '<div class="meta">"' + e.note + '"</div>' : "") +
        '<span class="tag">' + e.region + "</span>" +
        "</div>";
      gallery.appendChild(div);
    });
  } catch (e) {
    gallery.innerHTML = '<p class="loading">Gagal memuat daftar.</p>';
  }
}