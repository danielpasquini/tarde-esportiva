import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, timingSafeEqual } from "node:crypto";

const COOKIE = "te_admin";

function sessionToken() {
  return createHash("sha256").update(`tarde-esportiva:${process.env.ADMIN_PIN ?? ""}`).digest("hex");
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function isAdmin() {
  if (!process.env.ADMIN_PIN) return false;
  const value = (await cookies()).get(COOKIE)?.value;
  return !!value && safeEqual(value, sessionToken());
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/entrar");
}

export async function signIn(pin: string) {
  const expected = process.env.ADMIN_PIN;
  if (!expected || !safeEqual(pin, expected)) return false;
  (await cookies()).set(COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return true;
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
}
