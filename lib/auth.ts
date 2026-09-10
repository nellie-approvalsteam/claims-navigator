import crypto from "crypto";
import { cookies } from "next/headers";

// Minimal shared-password admin auth. No user accounts, no personal API
// keys, no third-party auth dependency — just a passphrase set via the
// ADMIN_PASSWORD environment variable, and a signed cookie so the browser
// can't forge a session. This is intentionally simple for v1; the
// upgrade path (documented in README.md) is to swap this module for
// NextAuth or your organization's SSO without touching the rest of the
// app, since every admin route checks auth through isAdminRequest() here.

export const SESSION_COOKIE = "cn_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set. Set it as an environment variable before using the admin area (see .env.example)."
    );
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionToken(): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `admin.${expires}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [role, expiresStr, sig] = parts;
  const payload = `${role}.${expiresStr}`;
  let expectedSig: string;
  try {
    expectedSig = sign(payload);
  } catch {
    return false;
  }
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;
  const expires = Number(expiresStr);
  if (Number.isNaN(expires) || Date.now() > expires) return false;
  return role === "admin";
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error(
      "ADMIN_PASSWORD is not set. Set it as an environment variable before using the admin area (see .env.example)."
    );
  }
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Server Component / Route Handler helper — reads the incoming cookie jar.
export function isAdminRequest(): boolean {
  try {
    const token = cookies().get(SESSION_COOKIE)?.value;
    return verifySessionToken(token);
  } catch {
    return false;
  }
}
