import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "notae_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h — cobre a duração do evento

interface SessionPayload {
  eventId: string;
  exp: number;
}

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value) throw new Error("ADMIN_SESSION_SECRET não configurado");
  return value;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("hex");
}

/** Cria o valor do cookie de sessão do admin após validar o PIN do evento. */
export function createAdminSessionToken(eventId: string): string {
  const payload: SessionPayload = { eventId, exp: Date.now() + SESSION_TTL_MS };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(data);
  return `${data}.${signature}`;
}

/** Valida o cookie de sessão e retorna o eventId autorizado, ou null. */
export function verifyAdminSessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expected = sign(data);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload.eventId;
  } catch {
    return null;
  }
}

export const ADMIN_SESSION_COOKIE = COOKIE_NAME;
export const ADMIN_SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;
