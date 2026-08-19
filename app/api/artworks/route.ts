import { requireAdmin } from "@/lib/auth";
import { createArtwork, listArtworks } from "@/lib/d1-gateway";
import { deleteArtworkObject, putArtwork } from "@/lib/r2-storage";
import { dataServicesEnabled } from "@/lib/runtime";

export async function GET(request: Request) {
  if (!dataServicesEnabled()) return Response.json({ artworks: [] }, { headers: { "cache-control": "no-store" } });
  const url = new URL(request.url);
  const includeHidden = url.searchParams.get("admin") === "1" && await requireAdmin();
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 12));
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  try {
    const result = await listArtworks(includeHidden, limit, page);
    const artworks = result.artworks.map((row) => ({ ...row, imageUrl: `/api/images/${encodeURIComponent(row.imageKey)}` }));
    return Response.json({ artworks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database unavailable";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!dataServicesEnabled()) return Response.json({ error: "Artwork storage is temporarily unavailable." }, { status: 503 });
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File) || !file.type.startsWith("image/")) return Response.json({ error: "An image is required." }, { status: 400 });
    if (file.size > 25 * 1024 * 1024) return Response.json({ error: "Images must be smaller than 25 MB." }, { status: 413 });
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "");
    const key = `artworks/${crypto.randomUUID()}-${safeName || "image"}`;
    await putArtwork(key, file);
    const title = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Artwork";
    try {
      const result = await createArtwork({
        title,
        artworkDate: String(form.get("artworkDate") || ""),
        description: String(form.get("description") || "").slice(0, 300),
        imageKey: key,
        published: form.get("published") === "true",
      });
      return Response.json({ id: result.id }, { status: 201 });
    } catch (error) {
      await deleteArtworkObject(key).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
