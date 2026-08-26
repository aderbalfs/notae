import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;

/** Gera um hash salgado (scrypt) do PIN do admin para armazenar no banco. */
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(pin, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${derived}`;
}

/** Compara um PIN em texto puro com o hash salvo, em tempo constante. */
export function verifyPin(pin: string, storedHash: string): boolean {
  const [salt, derivedHex] = storedHash.split(":");
  if (!salt || !derivedHex) return false;
  const derived = scryptSync(pin, salt, KEY_LENGTH);
  const stored = Buffer.from(derivedHex, "hex");
  if (derived.length !== stored.length) return false;
  return timingSafeEqual(derived, stored);
}
