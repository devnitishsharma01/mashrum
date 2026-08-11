import path from "path";
import { Router } from "express";
import multer from "multer";
import { env } from "../config/env";
import { AppError } from "../lib/errors";
import { getStorageDriver, storeImage } from "../lib/storage";
import {
  requireAuth,
  requirePermission,
  tenantId,
} from "../middleware/auth";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(
        new AppError(
          400,
          "Only JPEG, PNG, WebP, or GIF images are allowed",
          "INVALID_FILE",
        ),
      );
      return;
    }
    cb(null, true);
  },
});

function buildFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase() || ".jpg";
  const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)
    ? ext
    : ".jpg";
  return `${Date.now()}-${Math.random().toString(16).slice(2)}${safeExt}`;
}

export const uploadRouter = Router();

uploadRouter.use(requireAuth);

uploadRouter.get("/status", requirePermission("catalog:read"), (_req, res) => {
  res.json({
    data: {
      driver: getStorageDriver(),
      maxBytes: env.UPLOAD_MAX_BYTES,
    },
  });
});

uploadRouter.post(
  "/images",
  requirePermission("catalog:write"),
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          next(
            new AppError(
              400,
              `Image must be under ${Math.round(env.UPLOAD_MAX_BYTES / (1024 * 1024))}MB`,
              "FILE_TOO_LARGE",
            ),
          );
          return;
        }
        next(new AppError(400, err.message, "UPLOAD_ERROR"));
        return;
      }
      if (err) {
        next(err);
        return;
      }
      next();
    });
  },
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw new AppError(400, "No file uploaded", "NO_FILE");
      }

      const businessId = tenantId(req);
      const filename = buildFilename(req.file.originalname);
      const stored = await storeImage({
        businessId,
        filename,
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
      });

      res.status(201).json({
        data: {
          url: stored.url,
          path: `/${stored.key}`,
          key: stored.key,
          driver: stored.driver,
          size: req.file.size,
          mimeType: req.file.mimetype,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
