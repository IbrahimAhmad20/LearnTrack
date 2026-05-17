const multer = require("multer");
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const path = require("path");
const crypto = require("crypto");

// ── S3 client ─────────────────────────────────────────────────────────────────
const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET;
const CDN_BASE =
  process.env.AWS_CLOUDFRONT_URL || `https://${BUCKET}.s3.amazonaws.com`;

// ── Allowed MIME types per upload context ────────────────────────────────────
const ALLOWED = {
  avatar: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  thumbnail: ["image/jpeg", "image/png", "image/webp"],
  content: [
    "application/pdf",
    "video/mp4",
    "video/webm",
    "video/ogg",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "text/plain",
  ],
};

const MAX_SIZE = {
  avatar: 5 * 1024 * 1024, //  5 MB
  thumbnail: 10 * 1024 * 1024, // 10 MB
  content: 500 * 1024 * 1024, // 500 MB
};

// ── multer: store in memory for streaming to S3 ──────────────────────────────
function makeMulter(context) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SIZE[context] },
    fileFilter(_req, file, cb) {
      if (ALLOWED[context].includes(file.mimetype)) return cb(null, true);
      cb(
        new multer.MulterError(
          "LIMIT_UNEXPECTED_FILE",
          `${file.mimetype} not allowed for ${context}`,
        ),
      );
    },
  });
}

// ── Upload a buffer to S3 ────────────────────────────────────────────────────
async function uploadToS3({ buffer, mimetype, folder, originalname }) {
  const ext = path.extname(originalname) || "";
  const key = `${folder}/${crypto.randomUUID()}${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    }),
  );

  return { key, url: `${CDN_BASE}/${key}` };
}

// ── Delete an object from S3 by its key ──────────────────────────────────────
async function deleteFromS3(key) {
  if (!key) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    console.warn("S3 delete warning:", err.message);
  }
}

// ── Extract key from a full URL (CloudFront or S3) ───────────────────────────
function keyFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    // Strip leading slash
    return u.pathname.replace(/^\//, "");
  } catch {
    return null;
  }
}

// ── Express middleware factories ─────────────────────────────────────────────
const avatarUpload = makeMulter("avatar");
const thumbnailUpload = makeMulter("thumbnail");
const contentUpload = makeMulter("content");

module.exports = {
  s3,
  uploadToS3,
  deleteFromS3,
  keyFromUrl,
  avatarUpload,
  thumbnailUpload,
  contentUpload,
};
