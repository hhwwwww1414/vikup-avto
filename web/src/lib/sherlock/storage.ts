import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "../env";

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

export function isAllowedSherlockReportKey(key: string): boolean {
  return /^intelligence\/sherlock\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/report\.(pdf|html|json|txt|bin)$/i.test(
    key,
  );
}

export async function storeSherlockReportArtifact(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  if (!isAllowedSherlockReportKey(params.key)) {
    throw new Error("Invalid Sherlock report artifact key");
  }
  await s3().send(
    new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );
}

export async function getSherlockReportStream(key: string): Promise<{
  body: ReadableStream | null;
  contentType: string;
  contentLength?: number;
}> {
  if (!isAllowedSherlockReportKey(key)) {
    throw new Error("Invalid Sherlock report artifact key");
  }
  const res = await s3().send(
    new GetObjectCommand({
      Bucket: env.s3Bucket,
      Key: key,
    }),
  );
  const body = res.Body as unknown as {
    transformToWebStream?: () => ReadableStream;
  };
  return {
    body: body?.transformToWebStream ? body.transformToWebStream() : null,
    contentType: res.ContentType ?? "application/octet-stream",
    contentLength: res.ContentLength,
  };
}
