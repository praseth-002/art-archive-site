import { getArtwork } from "@/lib/r2-storage";
import { dataServicesEnabled } from "@/lib/runtime";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  if (!dataServicesEnabled()) return new Response("Artwork storage is temporarily unavailable.", { status: 503, headers: { "cache-control": "no-store" } });
  const { key } = await params;
  const object = await getArtwork(key).catch(() => null);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.bytes as BodyInit, { headers: {
    "content-type": object.contentType,
    "cache-control": "public, max-age=31536000, immutable",
    ...(object.etag ? { etag: object.etag } : {}),
  } });
}
