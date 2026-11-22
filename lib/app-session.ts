import { env } from "cloudflare:workers";
import { headers } from "next/headers";

const COOKIE_NAME = "nawaratt_session";
const SESSION_SECONDS = 60 * 60 * 24 * 14;

type SessionPayload = {
  email: string;
  exp: number;
};

function sessionSecret() {
  const secret = (env as unknown as Record<string, string | undefined>).APP_SESSION_SECRET;
  if (!secret) throw new Error("Application login is not configured");
  return secret;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionToken(email: string) {
  const payload: SessionPayload = {
    email: email.trim().toLocaleLowerCase(),
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  };
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(encoded));
  return `${encoded}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function readSessionEmail() {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";
  const raw = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!raw) return null;

  try {
    const [encoded, signature] = raw.split(".");
    if (!encoded || !signature) return null;
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      fromBase64Url(signature),
      new TextEncoder().encode(encoded),
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as SessionPayload;
    if (!payload.email || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload.email.toLocaleLowerCase();
  } catch {
    return null;
  }
}

export function sessionCookie(token: string) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
