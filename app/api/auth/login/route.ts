import { createSessionCookie } from "@/lib/auth";
import { runtime } from "@/lib/runtime";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const configured = runtime().ADMIN_PASSWORD;
  if (!configured) return Response.json({ error: "Admin login has not been configured yet." }, { status: 503 });
  const body = await request.json() as { password?: string };
  if (!body.password || body.password !== configured) return Response.json({ error: "That password is not correct." }, { status: 401 });
  const session = await createSessionCookie();
  (await cookies()).set(session.name, session.value, session.options);
  return Response.json({ ok: true });
}
