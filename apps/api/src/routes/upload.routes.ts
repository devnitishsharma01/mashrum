import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import { env } from "../config/env";
import { AppError } from "../lib/errors";
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

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      const businessId = tenantId(req);
      const dir = path.join(env.UPLOAD_DIR, businessId);
      ensureDir(dir);
      cb(null, dir);
    } catch (error) {
      cb(error as Error, env.UPLOAD_DIR);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)
      ? ext
      : ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.UPLOAD_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new AppError(400, "Only JPEG, PNG, WebP, or GIF images are allowed", "INVALID_FILE"));
      return;
    }
    cb(null, true);
  },
});

export const uploadRouter = Router();

uploadRouter.use(requireAuth);

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
      const relativePath = `/uploads/${businessId}/${req.file.filename}`;
      const url = `${env.API_URL}${relativePath}`;
      res.status(201).json({
        data: {
          url,
          path: relativePath,
          size: req.file.size,
          mimeType: req.file.mimetype,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
