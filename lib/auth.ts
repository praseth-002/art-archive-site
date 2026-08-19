import { cookies } from "next/headers";
import { runtime } from "./runtime";

const COOKIE_NAME = "art_archive_session";
const MAX_AGE = 60 * 60 * 24 * 14;
const ENTRANCE_COOKIE_NAME = "art_archive_entrance";
const ENTRANCE_MAX_AGE = 60 * 5;

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string) {
  if (!value || value.length % 2 !== 0 || !/^[a-f0-9]+$/i.test(value)) return null;
  return Uint8Array.from(value.match(/.{2}/g) || [], (byte) => Number.parseInt(byte, 16));
}

async function signingKey(secret: string) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function sign(value: string, secret: string) {
  return toHex(await crypto.subtle.sign("HMAC", await signingKey(secret), new TextEncoder().encode(value)));
}

async function verify(value: string, signature: string, secret: string) {
  const bytes = fromHex(signature);
  if (!bytes) return false;
  return crypto.subtle.verify("HMAC", await signingKey(secret), bytes, new TextEncoder().encode(value));
}

async function createSignedCookie(name: string, role: string, maxAge: number) {
  const secret = runtime().SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  const expires = Math.floor(Date.now() / 1000) + maxAge;
  const payload = `${role}.${expires}`;
  return { name, value: `${payload}.${await sign(payload, secret)}`, options: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge } };
}

async function hasSignedCookie(name: string, expectedRole: string) {
  const secret = runtime().SESSION_SECRET;
  const value = (await cookies()).get(name)?.value;
  if (!secret || !value) return false;
  const [role, expires, signature] = value.split(".");
  const expiry = Number(expires);
  if (role !== expectedRole || !Number.isFinite(expiry) || expiry < Date.now() / 1000 || !signature) return false;
  return verify(`${role}.${expires}`, signature, secret);
}

export async function createSessionCookie() {
  return createSignedCookie(COOKIE_NAME, "admin", MAX_AGE);
}

export async function createEntranceCookie() {
  return createSignedCookie(ENTRANCE_COOKIE_NAME, "entrance", ENTRANCE_MAX_AGE);
}

export async function isAdmin() {
  return hasSignedCookie(COOKIE_NAME, "admin");
}

export async function hasAdminEntrance() {
  return hasSignedCookie(ENTRANCE_COOKIE_NAME, "entrance");
}

export async function requireAdmin() {
  return isAdmin();
}

export const sessionCookieName = COOKIE_NAME;
export const entranceCookieName = ENTRANCE_COOKIE_NAME;
