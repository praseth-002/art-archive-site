import { sessionCookieName } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST() {
  (await cookies()).set(sessionCookieName, "", { httpOnly: true, path: "/", maxAge: 0 });
  return Response.json({ ok: true });
}
