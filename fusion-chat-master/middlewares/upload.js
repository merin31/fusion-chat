const multer = require("multer");
const path = require("path");
const fs = require("fs");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "-");
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`);
  }
});

const ALLOWED_EXT = [
  ".jpg", ".jpeg", ".png", ".gif",
  ".pdf", ".doc", ".docx", ".txt",
  ".xls", ".xlsx", ".ppt", ".pptx",
  ".mp3", ".mp4", ".mov", ".webm"
];

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXT.includes(ext)) cb(null, true);
  else cb(new Error("File type not allowed: " + ext));
}

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter });

module.exports = (fieldName = "file", maxCount = 1) => {
  return maxCount === 1 ? upload.single(fieldName) : upload.array(fieldName, maxCount);
};
