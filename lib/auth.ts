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
// Separate cookie for the team (non-admin) passphrase that unlocks Claim
// Lookup. Lookup returns live client data from Contractors Cloud, so unlike
// the rest of the tool it can't be open to anyone who has the URL.
export const TEAM_SESSION_COOKIE = "cn_team_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

type Role = "admin" | "team";
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000; // 12 hours

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

export function createSessionToken(role: Role = "admin"): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${role}.${expires}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifySessionToken(
  token: string | undefined | null,
  role: Role = "admin"
): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [tokenRole, expiresStr, sig] = parts;
  const payload = `${tokenRole}.${expiresStr}`;
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
  return tokenRole === role;
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error(
      "ADMIN_PASSWORD is not set. Set it as an environment variable before using the admin area (see .env.example)."
    );
  }
  return safeEqual(candidate, expected);
}

export function checkTeamPassword(candidate: string): boolean {
  const expected = process.env.TEAM_PASSWORD;
  if (!expected) {
    throw new Error(
      "TEAM_PASSWORD is not set. Set it as an environment variable before using Claim Lookup (see .env.example)."
    );
  }
  return safeEqual(candidate, expected);
}

function safeEqual(candidate: string, expected: string): boolean {
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

// Claim Lookup access: a team session, or an admin session (admins are
// team members too, so they don't need to enter a second passphrase).
export function isTeamRequest(): boolean {
  if (isAdminRequest()) return true;
  try {
    const token = cookies().get(TEAM_SESSION_COOKIE)?.value;
    return verifySessionToken(token, "team");
  } catch {
    return false;
  }
}
