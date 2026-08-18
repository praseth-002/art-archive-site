import { requireAdmin } from "@/lib/auth";
import { deleteArtworkRecord, updateArtwork } from "@/lib/d1-gateway";
import { deleteArtworkObject } from "@/lib/r2-storage";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;
  await updateArtwork(Number(id), {
    artworkDate: String(body.artworkDate || ""),
    description: String(body.description || "").slice(0, 300),
    published: body.published === "true" || body.published === true,
  });
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await deleteArtworkRecord(Number(id));
  if (result.imageKey) await deleteArtworkObject(result.imageKey);
  return Response.json({ ok: true });
}
