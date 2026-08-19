import { createSessionCookie, entranceCookieName, hasAdminEntrance } from "@/lib/auth";
import { clearLoginAttempts, consumeLoginAttempt } from "@/lib/login-rate-limit";
import { adminEntranceRequired, loginRateLimitEnabled, runtime } from "@/lib/runtime";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  if (adminEntranceRequired() && !(await hasAdminEntrance())) {
    return Response.json({ error: "Not found." }, { status: 404, headers: { "cache-control": "no-store" } });
  }

  const rateLimitEnabled = loginRateLimitEnabled();
  if (rateLimitEnabled) {
    const attempt = consumeLoginAttempt(request);
    if (!attempt.allowed) {
      return Response.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429, headers: { "cache-control": "no-store", "retry-after": String(attempt.retryAfter) } },
      );
    }
  }

  const configured = runtime().ADMIN_PASSWORD;
  if (!configured) return Response.json({ error: "Admin login has not been configured yet." }, { status: 503 });
  const body = await request.json().catch(() => null) as { password?: string } | null;
  if (!body?.password || body.password !== configured) return Response.json({ error: "That password is not correct." }, { status: 401, headers: { "cache-control": "no-store" } });

  const session = await createSessionCookie();
  if (rateLimitEnabled) clearLoginAttempts(request);
  const cookieStore = await cookies();
  cookieStore.set(session.name, session.value, session.options);
  cookieStore.delete(entranceCookieName);
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
