import { createSessionCookie, entranceCookieName, hasAdminEntrance } from "@/lib/auth";
import { clearLoginAttempts, consumeLoginAttempt } from "@/lib/login-rate-limit";
import { runtime } from "@/lib/runtime";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  if (!await hasAdminEntrance()) return Response.json({ error: "Not found." }, { status: 404, headers: { "cache-control": "no-store" } });

  const rateLimit = consumeLoginAttempt(request);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429, headers: { "cache-control": "no-store", "retry-after": String(rateLimit.retryAfter) } },
    );
  }

  const configured = runtime().ADMIN_PASSWORD;
  if (!configured) return Response.json({ error: "Admin login has not been configured yet." }, { status: 503 });
  const body = await request.json().catch(() => null) as { password?: string } | null;
  if (!body?.password || body.password !== configured) return Response.json({ error: "That password is not correct." }, { status: 401, headers: { "cache-control": "no-store" } });

  clearLoginAttempts(request);
  const session = await createSessionCookie();
  const cookieStore = await cookies();
  cookieStore.set(session.name, session.value, session.options);
  cookieStore.set(entranceCookieName, "", { httpOnly: true, path: "/", maxAge: 0 });
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
