import type { SecurityStore } from "./security";

export type ProvisionedUserInput = {
  username: string;
  email: string;
  password: string;
};

export type UsernameIndexRecord = {
  state: "ready";
  owner: string;
  userId: string;
  email: string;
  username: string;
};

type ProvisioningStore = Pick<SecurityStore, "get" | "set" | "setIfAbsent" | "deleteIfOwner">;
type AuthUserIdentity = { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null };
type AuditInput = { actorId: string; action: string; targetId?: string; after?: unknown; ip?: string; userAgent?: string };
type ProvisioningAuth = {
  createBlocked(attributes: { email: string; password: string; email_confirm: true; ban_duration: "876000h"; user_metadata: { username: string }; app_metadata: Record<string, unknown> }): Promise<{ userId: string }>;
  activate(userId: string, attributes: { ban_duration: "none"; app_metadata: Record<string, unknown> }): Promise<void>;
  block(userId: string, attributes: { ban_duration: "876000h"; app_metadata: Record<string, unknown> }): Promise<void>;
  remove(userId: string): Promise<void>;
  exists(userId: string): Promise<boolean>;
};

export class DuplicateProvisioningIdentityError extends Error {}
export class ProvisioningUncertainError extends Error {}
export class ProvisioningFailedError extends Error {}

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
  return (await resolveLoginIdentity(store, identifier))?.email ?? null;
}

export async function resolveLoginIdentity(store: Pick<SecurityStore, "get">, identifier: unknown) {
  const value = String(identifier || "").trim().toLowerCase();
  if (EMAIL.test(value) && value.length <= 254) return { email: value, index: null };
  const username = normalizeUsername(value);
  if (!USERNAME.test(username)) return null;
  const record = await store.get(usernameIndexKey(username));
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const candidate = record as Partial<UsernameIndexRecord>;
  if (
    candidate.state !== "ready" ||
    typeof candidate.owner !== "string" ||
    !candidate.owner ||
    typeof candidate.userId !== "string" ||
    !candidate.userId ||
    candidate.username !== username ||
    typeof candidate.email !== "string" ||
    !EMAIL.test(candidate.email) ||
    candidate.email.length > 254
  )
    return null;
  return { email: candidate.email.toLowerCase(), index: candidate as UsernameIndexRecord };
}

export function usernameIdentityMatches(index: UsernameIndexRecord, user: AuthUserIdentity) {
  return (
    index.state === "ready" &&
    user.id === index.userId &&
    String(user.email || "").trim().toLowerCase() === index.email &&
    normalizeUsername(user.user_metadata?.username) === index.username
  );
}

export async function provisionDirectUser(input: {
  account: ProvisionedUserInput;
  metadata: Record<string, unknown>;
  actorId: string;
  evidence: { ip?: string; userAgent?: string };
  store: ProvisioningStore;
  auth: ProvisioningAuth;
  writeAudit(event: AuditInput): Promise<unknown>;
}) {
  const { account, metadata, actorId, evidence, store, auth, writeAudit } = input,
    key = usernameIndexKey(account.username),
    owner = crypto.randomUUID(),
    blockedMetadata = { ...metadata, status: "blocked" },
    reserved = await store.setIfAbsent(key, {
      state: "creating",
      owner,
      username: account.username,
      email: account.email,
    });
  if (!reserved) throw new DuplicateProvisioningIdentityError("Benutzername oder E-Mail ist bereits vergeben.");
  let userId = "";
  try {
    const created = await auth.createBlocked({
      email: account.email,
      password: account.password,
      email_confirm: true,
      ban_duration: "876000h",
      user_metadata: { username: account.username },
      app_metadata: blockedMetadata,
    });
    userId = created.userId;
    const index: UsernameIndexRecord = {
      state: "ready",
      owner,
      userId,
      email: account.email,
      username: account.username,
    };
    await store.set(key, index);
    await writeAudit({
      actorId,
      action: "user.create",
      targetId: userId,
      after: { identity: { username: account.username, email: account.email }, access: metadata },
      ...evidence,
    });
    await auth.activate(userId, { ban_duration: "none", app_metadata: metadata });
    return { userId };
  } catch (cause) {
    if (!userId) {
      await store.deleteIfOwner(key, owner);
      throw cause;
    }
    try {
      await auth.block(userId, { ban_duration: "876000h", app_metadata: blockedMetadata });
    } catch {
      // The account was created blocked; this is an additional fail-closed attempt.
    }
    try {
      await auth.remove(userId);
    } catch {
      // Verified below; a failed response does not prove the account still exists.
    }
    let exists = true;
    try {
      exists = await auth.exists(userId);
    } catch {
      exists = true;
    }
    if (exists) {
      await store.set(key, {
        state: "rollback_required",
        owner,
        userId,
        username: account.username,
        email: account.email,
      });
      try {
        await writeAudit({ actorId, action: "user.create_rollback_failed", targetId: userId, after: { username: account.username, email: account.email }, ...evidence });
      } catch {}
      throw new ProvisioningUncertainError("Benutzerkonto blieb gesperrt und muss geprüft werden.", { cause });
    }
    const removed = await store.deleteIfOwner(key, owner), remaining = await store.get(key);
    if (!removed || remaining !== null) {
      try {
        await store.set(key, { state: "rollback_required", owner, userId, username: account.username, email: account.email });
      } catch {}
      throw new ProvisioningUncertainError("Bereinigung des Benutzernamens muss geprüft werden.", { cause });
    }
    try {
      await writeAudit({ actorId, action: "user.create_rolled_back", targetId: userId, after: { username: account.username, email: account.email }, ...evidence });
    } catch {}
    throw new ProvisioningFailedError("Provisionierung fehlgeschlagen.", { cause });
  }
}
