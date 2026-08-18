import { cookies } from "next/headers";
import { runtime } from "./runtime";

const COOKIE_NAME = "art_archive_session";
const MAX_AGE = 60 * 60 * 24 * 14;

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

export async function createSessionCookie() {
  const secret = runtime().SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `admin.${expires}`;
  return { name: COOKIE_NAME, value: `${payload}.${await sign(payload, secret)}`, options: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: MAX_AGE } };
}

export async function isAdmin() {
  const secret = runtime().SESSION_SECRET;
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  if (!secret || !value) return false;
  const [role, expires, signature] = value.split(".");
  if (role !== "admin" || !expires || !signature || Number(expires) < Date.now() / 1000) return false;
  return (await sign(`${role}.${expires}`, secret)) === signature;
}

export async function requireAdmin() {
  return isAdmin();
}

export const sessionCookieName = COOKIE_NAME;
