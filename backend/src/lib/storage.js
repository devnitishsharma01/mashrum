"use strict";

const fs = require("fs/promises");
const path = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { env } = require("../config/env");

function publicUrlForKey(key) {
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

async function saveLocal(params) {
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
      "S3 storage selected but bucket/access key/secret are missing (set AWS_* or S3_* env vars)",
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

async function saveS3(params) {
  const client = createS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: params.key,
      Body: params.buffer,
      ContentType: params.mimeType,
      ...(env.S3_OBJECT_ACL ? { ACL: env.S3_OBJECT_ACL } : {}),
    }),
  );

  return {
    key: params.key,
    url: publicUrlForKey(params.key),
    driver: "s3",
  };
}

function getStorageDriver() {
  return env.STORAGE_DRIVER;
}

async function storeImage(params) {
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

module.exports = {
  getStorageDriver,
  storeImage,
};
