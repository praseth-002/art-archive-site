import { getArtwork } from "@/lib/r2-storage";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const object = await getArtwork(key).catch(() => null);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.bytes as BodyInit, { headers: {
    "content-type": object.contentType,
    "cache-control": "public, max-age=31536000, immutable",
    ...(object.etag ? { etag: object.etag } : {}),
  } });
}
