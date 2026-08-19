import { createEntranceCookie } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST() {
  const entrance = await createEntranceCookie();
  (await cookies()).set(entrance.name, entrance.value, entrance.options);
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
