import fs from "fs/promises";
import path from "path";
import { PutObjectCommand, S3Client, type ObjectCannedACL } from "@aws-sdk/client-s3";
import { env } from "../config/env";

export type StoredObject = {
  key: string;
  url: string;
  driver: "local" | "s3";
};

function publicUrlForKey(key: string): string {
  if (env.STORAGE_DRIVER === "s3") {
    if (env.S3_PUBLIC_URL_BASE) {
      return `${env.S3_PUBLIC_URL_BASE.replace(/\/$/, "")}/${key}`;
    }
    if (env.S3_ENDPOINT) {
      return `${env.S3_ENDPOINT.replace(/\/$/, "")}/${env.S3_BUCKET}/${key}`;
    }
    return `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`;
  }
  return `${env.API_URL}/uploads/${key}`;
}

async function saveLocal(params: {
  key: string;
  buffer: Buffer;
}): Promise<StoredObject> {
  const absolute = path.resolve(env.UPLOAD_DIR, params.key);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, params.buffer);
  return {
    key: params.key,
    url: publicUrlForKey(params.key),
    driver: "local",
  };
}

function createS3Client() {
  if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new Error(
      "S3 storage selected but S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY are missing",
    );
  }

  return new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(env.S3_ENDPOINT),
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
}

async function saveS3(params: {
  key: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<StoredObject> {
  const client = createS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: params.key,
      Body: params.buffer,
      ContentType: params.mimeType,
      ...(env.S3_OBJECT_ACL
        ? { ACL: env.S3_OBJECT_ACL as ObjectCannedACL }
        : {}),
    }),
  );

  return {
    key: params.key,
    url: publicUrlForKey(params.key),
    driver: "s3",
  };
}

export function getStorageDriver(): "local" | "s3" {
  return env.STORAGE_DRIVER;
}

export async function storeImage(params: {
  businessId: string;
  filename: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<StoredObject> {
  const key = `${params.businessId}/${params.filename}`;
  if (env.STORAGE_DRIVER === "s3") {
    return saveS3({
      key,
      buffer: params.buffer,
      mimeType: params.mimeType,
    });
  }
  return saveLocal({ key, buffer: params.buffer });
}
