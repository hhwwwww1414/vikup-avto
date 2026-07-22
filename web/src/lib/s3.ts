import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import { env } from "./env";
import { log } from "./logger";
import { thumbKey, buildVehicleKey } from "./s3-keys";

export { thumbKey, buildVehicleKey } from "./s3-keys";

let client: S3Client | null = null;
function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: env.s3Endpoint,
      region: env.s3Region,
      forcePathStyle: env.s3ForcePathStyle,
      credentials: {
        accessKeyId: env.s3AccessKeyId,
        secretAccessKey: env.s3SecretAccessKey,
      },
    });
  }
  return client;
}

export interface StoredPhoto {
  photoKey: string;
  thumbKey: string;
}

/**
 * Normalize an uploaded photo to JPEG, create a thumbnail, and store both in
 * S3. The original filename from Telegram is never used for the key.
 */
export async function storeVehiclePhoto(original: Buffer): Promise<StoredPhoto> {
  const key = buildVehicleKey();
  const tKey = thumbKey(key);

  // Re-encode original to a sane JPEG (strips EXIF/metadata, bounds size).
  const normalized = await sharp(original)
    .rotate() // auto-orient using EXIF then drop it
    .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();

  const thumb = await sharp(original)
    .rotate()
    .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 72 })
    .toBuffer();

  await Promise.all([
    s3().send(
      new PutObjectCommand({
        Bucket: env.s3Bucket,
        Key: key,
        Body: normalized,
        ContentType: "image/jpeg",
      }),
    ),
    s3().send(
      new PutObjectCommand({
        Bucket: env.s3Bucket,
        Key: tKey,
        Body: thumb,
        ContentType: "image/jpeg",
      }),
    ),
  ]);

  log.info("s3.upload.success", { key, thumb: tKey });
  return { photoKey: key, thumbKey: tKey };
}

export interface FetchedObject {
  body: ReadableStream | null;
  contentType: string;
  contentLength?: number;
}

/** Fetch an object for the image proxy. Returns a web ReadableStream. */
export async function getObjectStream(key: string): Promise<FetchedObject> {
  const res = await s3().send(
    new GetObjectCommand({ Bucket: env.s3Bucket, Key: key }),
  );
  // In the Node SDK, Body is a Node Readable; convert to web stream.
  const body = res.Body as unknown as {
    transformToWebStream?: () => ReadableStream;
  };
  return {
    body: body?.transformToWebStream ? body.transformToWebStream() : null,
    contentType: res.ContentType ?? "image/jpeg",
    contentLength: res.ContentLength,
  };
}
