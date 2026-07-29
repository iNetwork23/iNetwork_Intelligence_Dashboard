import type { SecurityStore } from "./security";

export type ProvisionedUserInput = {
  username: string;
  email: string;
  password: string;
};

export type UsernameIndexRecord = {
  userId: string;
  email: string;
  username: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,39}$/;

export function normalizeUsername(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function usernameIndexKey(value: unknown) {
  return `auth:username:${normalizeUsername(value)}`;
}

export function parseProvisionedUser(input: Record<string, unknown>): ProvisionedUserInput {
  const username = normalizeUsername(input.username);
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");
  if (!USERNAME.test(username))
    throw new Error("Benutzername muss 3–40 Zeichen lang sein und darf nur Buchstaben, Zahlen, Punkt, Minus und Unterstrich enthalten.");
  if (!EMAIL.test(email) || email.length > 254) throw new Error("E-Mail-Adresse ist ungültig.");
  if (password.length < 12 || password.length > 128)
    throw new Error("Passwort muss zwischen 12 und 128 Zeichen lang sein.");
  return { username, email, password };
}

export async function resolveLoginEmail(store: Pick<SecurityStore, "get">, identifier: unknown) {
  const value = String(identifier || "").trim().toLowerCase();
  if (EMAIL.test(value) && value.length <= 254) return value;
  const username = normalizeUsername(value);
  if (!USERNAME.test(username)) return null;
  const record = await store.get(usernameIndexKey(username));
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const candidate = record as Partial<UsernameIndexRecord>;
  if (
    typeof candidate.userId !== "string" ||
    !candidate.userId ||
    candidate.username !== username ||
    typeof candidate.email !== "string" ||
    !EMAIL.test(candidate.email) ||
    candidate.email.length > 254
  )
    return null;
  return candidate.email.toLowerCase();
}
