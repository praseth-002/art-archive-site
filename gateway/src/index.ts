interface Env {
  DB: D1Database;
  GATEWAY_SECRET: string;
}

const schema = `
  CREATE TABLE IF NOT EXISTS artworks (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    title TEXT NOT NULL,
    year TEXT DEFAULT '' NOT NULL,
    medium TEXT DEFAULT 'Digital' NOT NULL,
    collection_name TEXT DEFAULT 'Archive' NOT NULL,
    description TEXT DEFAULT '' NOT NULL,
    image_key TEXT NOT NULL,
    published INTEGER DEFAULT 1 NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`;

function authorized(request: Request, env: Env) {
  const supplied = request.headers.get("authorization") || "";
  return Boolean(env.GATEWAY_SECRET) && supplied === `Bearer ${env.GATEWAY_SECRET}`;
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function ensureSchema(db: D1Database) {
  await db.prepare(schema).run();
}

async function handleArtworks(request: Request, env: Env, url: URL) {
  await ensureSchema(env.DB);
  const match = url.pathname.match(/^\/artworks\/(\d+)$/);

  if (request.method === "GET" && url.pathname === "/artworks") {
    const includeHidden = url.searchParams.get("admin") === "1";
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 12));
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const where = includeHidden ? "" : "WHERE published = 1";
    const result = await env.DB.prepare(`
      SELECT id, title, year AS artworkDate, description, image_key AS imageKey,
             published, sort_order AS sortOrder
      FROM artworks ${where}
      ORDER BY sort_order ASC, created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, (page - 1) * limit).all();
    return Response.json({ artworks: result.results.map((row) => ({ ...row, published: Boolean(row.published) })) });
  }

  if (request.method === "POST" && url.pathname === "/artworks") {
    const body = await request.json() as Record<string, unknown>;
    const title = String(body.title || "Artwork").slice(0, 200);
    const imageKey = String(body.imageKey || "");
    if (!imageKey.startsWith("artworks/")) return jsonError("A valid image key is required.", 400);
    const result = await env.DB.prepare(`
      INSERT INTO artworks
        (title, year, medium, collection_name, description, image_key, published, created_at, updated_at)
      VALUES (?, ?, 'Digital', 'Archive', ?, ?, ?, unixepoch(), unixepoch())
      RETURNING id
    `).bind(
      title,
      String(body.artworkDate || ""),
      String(body.description || "").slice(0, 300),
      imageKey,
      body.published === true ? 1 : 0,
    ).first<{ id: number }>();
    return Response.json({ id: result?.id }, { status: 201 });
  }

  if (match && request.method === "PATCH") {
    const body = await request.json() as Record<string, unknown>;
    await env.DB.prepare(`
      UPDATE artworks
      SET year = ?, description = ?, published = ?, updated_at = unixepoch()
      WHERE id = ?
    `).bind(
      String(body.artworkDate || ""),
      String(body.description || "").slice(0, 300),
      body.published === true ? 1 : 0,
      Number(match[1]),
    ).run();
    return Response.json({ ok: true });
  }

  if (match && request.method === "DELETE") {
    const id = Number(match[1]);
    const row = await env.DB.prepare("SELECT image_key AS imageKey FROM artworks WHERE id = ?")
      .bind(id).first<{ imageKey: string }>();
    await env.DB.prepare("DELETE FROM artworks WHERE id = ?").bind(id).run();
    return Response.json({ ok: true, imageKey: row?.imageKey });
  }

  return jsonError("Not found.", 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!authorized(request, env)) return jsonError("Unauthorized.", 401);
    const url = new URL(request.url);
    try {
      if (url.pathname === "/health" && request.method === "GET") {
        const result = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
        return Response.json({ ok: result?.ok === 1 });
      }
      if (url.pathname === "/artworks" || url.pathname.startsWith("/artworks/")) {
        return await handleArtworks(request, env, url);
      }
      return jsonError("Not found.", 404);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Gateway request failed.", 500);
    }
  },
} satisfies ExportedHandler<Env>;
