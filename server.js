const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { regions } = require("./data/characters");

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "submissions.json");
const UPLOAD_DIR = path.join(__dirname, "uploads");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOAD_DIR));

if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const ok = allowed.includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error("Format gambar tidak didukung"), ok);
  },
});

function loadData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.get("/api/regions", (req, res) => {
  res.json({ regions });
});

app.get("/api/submissions", (req, res) => {
  res.json(loadData());
});

app.post("/api/submit", upload.single("image"), (req, res) => {
  try {
    const { name, social, region, character, note } = req.body;
    if (!name || !region || !character) {
      throw new Error("Nama, region, dan karakter wajib diisi");
    }
    const data = loadData();
    const entry = {
      id: Date.now().toString(36),
      name: name.trim(),
      social: (social || "").trim(),
      region,
      character,
      note: (note || "").trim(),
      image: req.file ? "/uploads/" + req.file.filename : null,
      createdAt: new Date().toISOString(),
    };
    data.push(entry);
    saveData(data);
    res.send(
      '<html><head><meta http-equiv="refresh" content="2;url=/"></head><body style="font-family:sans-serif;text-align:center;padding-top:15vh"><h2 style="color:#4CAF50">Berhasil dikirim! Terima kasih sudah ikut collab.</h2><p>Dialihkan ke beranda...</p></body></html>'
    );
  } catch (err) {
    res.status(400).send(
      '<html><body style="font-family:sans-serif;text-align:center;padding-top:15vh"><h2 style="color:#e53935">Gagal kirim: ' +
        (err.message || "Terjadi kesalahan") +
        '</h2><a href="/">Kembali</a></body></html>'
    );
  }
});

app.listen(PORT, () => {
  console.log("Collab app running on http://localhost:" + PORT);
});
