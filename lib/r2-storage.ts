import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { runtime } from "./runtime";

let client: S3Client | undefined;

function configuration() {
  const env = runtime();
  const { R2_ENDPOINT: endpoint, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey, R2_BUCKET: bucket } = env;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) throw new Error("R2 storage is not configured.");
  return { endpoint, accessKeyId, secretAccessKey, bucket };
}

function r2() {
  const config = configuration();
  client ??= new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  return { client, bucket: config.bucket };
}

export async function putArtwork(key: string, file: File) {
  const { client, bucket } = r2();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: Buffer.from(await file.arrayBuffer()),
    ContentType: file.type,
    CacheControl: "public, max-age=31536000, immutable",
  }));
}

export async function getArtwork(key: string) {
  const { client, bucket } = r2();
  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!object.Body) return null;
  return {
    bytes: await object.Body.transformToByteArray(),
    contentType: object.ContentType || "application/octet-stream",
    etag: object.ETag,
  };
}

export async function deleteArtworkObject(key: string) {
  const { client, bucket } = r2();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
