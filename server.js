const express = require("express");
const multer = require("multer");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { regions } = require("./data/characters");

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "submissions.json");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const CONFIG_FILE = path.join(__dirname, "data", "formconfig.json");
const ADMIN_USER = process.env.ADMIN_USER || "wildanganteng";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "wildanganteng";
const MAX_FILE = 10 * 1024 * 1024;

const siteConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
const MAX_IMAGES_PER_CHAR = siteConfig.imagesPerChar || 6;
const IMG_TYPES = ["charIngame", "profile", "selfie"];

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", maxAge: 8 * 60 * 60 * 1000 },
  })
);

if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ---------- util ---------- */

function readData() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function safeField(v) {
  return typeof v === "string" ? v.trim().slice(0, 500) : "";
}
function magicType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "webp";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "gif";
  return null;
}
function regionName(id) {
  const r = regions.find((x) => x.id === id);
  return r ? r.name : (id || "");
}
function normalizeEntry(e) {
  if (Array.isArray(e.characters)) return e;
  const types = { charIngame: e.charImg, profile: e.profileImg, selfie: e.selfie };
  const images = IMG_TYPES.filter((t) => types[t]).map((t) => ({ type: t, src: types[t] }));
  return {
    id: e.id,
    name: e.name,
    social: e.social || "",
    note: e.note || "",
    createdAt: e.createdAt,
    updatedAt: e.updatedAt || e.createdAt,
    characters: [{
      region: e.region || "",
      regionName: regionName(e.region),
      element: e.element || "",
      character: e.character || "",
      affinity: e.affinity || "",
      images,
    }],
  };
}
function removeUploaded(urls) {
  (urls || []).forEach((u) => {
    try {
      const p = path.join(UPLOAD_DIR, path.basename(u));
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {}
  });
}

/* ---------- upload ---------- */

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, "tmp-" + Date.now() + "-" + crypto.randomBytes(6).toString("hex")),
  }),
  limits: { fileSize: MAX_FILE, files: 40 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (["", ".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) return cb(null, true);
    cb(new Error("Format gambar tidak didukung"));
  },
});

// Susun file upload menjadi { src, type } yang valid, per index karakter
function organizeFiles(files) {
  const perChar = {};   // idx -> [{type, src}]
  const invalid = [];   // originalname yang gagal
  (files || []).forEach((f) => {
    const m = /^imgs_(\d+)__(.+)$/.exec(f.fieldname || "");
    if (!m) { try { fs.unlinkSync(f.path); } catch {} return; }
    const idx = parseInt(m[1], 10);
    const type = m[2];
    try {
      const head = fs.readFileSync(f.path);
      const t = magicType(head);
      if (!t) {
        invalid.push(f.originalname || "file");
        fs.unlinkSync(f.path);
        return;
      }
      const safe = Date.now() + "-" + crypto.randomBytes(6).toString("hex") + "." + t;
      const dest = path.join(UPLOAD_DIR, safe);
      fs.renameSync(f.path, dest);
      if (!perChar[idx]) perChar[idx] = [];
      if (perChar[idx].length < MAX_IMAGES_PER_CHAR) perChar[idx].push({ type, src: "/uploads/" + safe });
      else fs.unlinkSync(dest);
    } catch {
      invalid.push(f.originalname || "file");
      try { fs.unlinkSync(f.path); } catch {}
    }
  });
  return { perChar, invalid };
}

function cleanupFiles(perChar) {
  Object.values(perChar).forEach((arr) => removeUploaded(arr.map((x) => x.src)));
}

/* ---------- API publik ---------- */

app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("/api/config", (req, res) => res.json(siteConfig));
app.get("/api/regions", (req, res) => res.json({ regions }));

app.get("/api/submissions", (req, res) => {
  res.json(readData().map(normalizeEntry));
});

app.post("/api/submit", (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) return next(err);
    try {
      const name = safeField(req.body.name);
      const social = safeField(req.body.social);
      const note = safeField(req.body.note);
      if (!name) throw new Error("Nama wajib diisi");

      const charCount = Math.min(parseInt(req.body.charCount, 10) || 1, siteConfig.maxCharacters || 6);
      const characters = [];
      for (let i = 0; i < charCount; i++) {
        const region = safeField(req.body["region_" + i]);
        const character = safeField(req.body["character_" + i]);
        if (!region || !character) continue;
        characters.push({
          region,
          regionName: regionName(region),
          element: safeField(req.body["element_" + i]),
          character,
          affinity: safeField(req.body["affinity_" + i]),
          images: [],
        });
      }
      if (!characters.length) throw new Error("Minimal satu karakter wajib dipilih");

      const { perChar, invalid } = organizeFiles(req.files);

      // cek gambar wajib per karakter sesuai konfigurasi
      const fieldCfg = siteConfig.fields || {};
      const requiredTypes = IMG_TYPES.filter((t) => fieldCfg[t] && fieldCfg[t].required !== false);
      for (let i = 0; i < characters.length; i++) {
        const imgs = perChar[i] || [];
        if (!imgs.length) {
          cleanupFiles(perChar);
          throw new Error("Unggah minimal satu gambar untuk " + characters[i].character);
        }
        for (const t of requiredTypes) {
          if (!imgs.some((x) => x.type === t)) {
            cleanupFiles(perChar);
            throw new Error("Field " + (fieldCfg[t].label || t) + " wajib diisi untuk " + characters[i].character);
          }
        }
      }

      if (invalid.length) {
        cleanupFiles(perChar);
        throw new Error("Ada file yang bukan gambar valid: " + invalid.join(", "));
      }

      characters.forEach((c, i) => { c.images = perChar[i] || []; });

      const entry = {
        id: Date.now().toString(36) + crypto.randomBytes(3).toString("hex"),
        name,
        social,
        note,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        characters,
      };

      const data = readData();
      data.push(entry);
      writeData(data);
      res.json({ ok: true, id: entry.id });
    } catch (e) {
      if (Array.isArray(req.files)) req.files.forEach((f) => { try { fs.unlinkSync(f.path); } catch {} });
      res.status(400).json({ ok: false, error: e.message || "Terjadi kesalahan" });
    }
  });
});

/* ---------- Admin ---------- */

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}
function requireAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.status(401).json({ ok: false, error: "Silakan login sebagai admin" });
}

app.post("/api/admin/login", (req, res) => {
  const user = String(req.body.username || "");
  const pass = String(req.body.password || "");
  if (!safeEqual(user, ADMIN_USER) || !safeEqual(pass, ADMIN_PASSWORD)) {
    return res.status(401).json({ ok: false, error: "Username atau password salah" });
  }
  req.session.admin = true;
  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/admin/me", requireAuth, (req, res) => res.json({ ok: true, user: ADMIN_USER }));

app.get("/api/admin/entries", requireAuth, (req, res) => {
  res.json(readData().map(normalizeEntry).reverse());
});

app.put("/api/admin/entries/:id", requireAuth, (req, res) => {
  const data = readData();
  const idx = data.findIndex((e) => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Tidak ditemukan" });
  const norm = normalizeEntry(data[idx]);
  norm.name = safeField(req.body.name) || norm.name;
  norm.social = safeField(req.body.social);
  norm.note = safeField(req.body.note);
  norm.updatedAt = new Date().toISOString();

  if (Array.isArray(req.body.characters)) {
    norm.characters = req.body.characters
      .filter((c) => c && c.region && c.character)
      .map((c) => ({
        region: safeField(c.region),
        regionName: regionName(c.region),
        element: safeField(c.element),
        character: safeField(c.character),
        affinity: safeField(c.affinity),
        images: Array.isArray(c.images) ? c.images.filter((x) => x && x.src) : [],
      }));
  }
  data[idx] = norm;
  writeData(data);
  res.json({ ok: true, entry: norm });
});

app.delete("/api/admin/entries/:id", requireAuth, (req, res) => {
  const data = readData();
  const idx = data.findIndex((e) => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Tidak ditemukan" });
  const norm = normalizeEntry(data[idx]);
  norm.characters.forEach((c) => removeUploaded(c.images.map((x) => x.src)));
  data.splice(idx, 1);
  writeData(data);
  res.json({ ok: true });
});

/* ---------- error handler ---------- */

app.use((err, req, res, next) => {
  if (Array.isArray(req.files)) req.files.forEach((f) => { try { fs.unlinkSync(f.path); } catch {} });
  res.status(400).json({ ok: false, error: err.message || "Terjadi kesalahan" });
});

app.listen(PORT, () => {
  console.log("Collab app running on http://localhost:" + PORT);
});