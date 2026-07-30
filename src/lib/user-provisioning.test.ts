import { describe, expect, it } from "vitest";
import {
  parseProvisionedUser,
  provisionDirectUser,
  ProvisioningUncertainError,
  resolveLoginEmail,
  usernameIdentityMatches,
  usernameIndexKey,
} from "./user-provisioning";

class MemoryStore {
  values = new Map<string, unknown>();
  async get(key: string) {
    return this.values.get(key) ?? null;
  }
  async set(key: string, value: unknown) {
    this.values.set(key, value);
  }
  async setIfAbsent(key: string, value: unknown) {
    if (this.values.has(key)) return false;
    this.values.set(key, value);
    return true;
  }
  async deleteIfOwner(key: string, owner: string) {
    const value = this.values.get(key) as { owner?: string } | undefined;
    if (value?.owner !== owner) return false;
    this.values.delete(key);
    return true;
  }
  async delete(key: string) {
    this.values.delete(key);
  }
}

describe("direct user provisioning", () => {
  it("normalizes a login username and email without changing the password", () => {
    expect(
      parseProvisionedUser({
        username: " Ergin.Admin ",
        email: " USER@Example.COM ",
        password: "  Lange Passphrase 2026!  ",
      }),
    ).toEqual({
      username: "ergin.admin",
      email: "user@example.com",
      password: "  Lange Passphrase 2026!  ",
    });
  });

  it.each([
    [{ username: "ab", email: "user@example.com", password: "Sicheres Passwort 2026!" }, "Benutzername"],
    [{ username: "name mit leerzeichen", email: "user@example.com", password: "Sicheres Passwort 2026!" }, "Benutzername"],
    [{ username: "valid.name", email: "keine-email", password: "Sicheres Passwort 2026!" }, "E-Mail"],
    [{ username: "valid.name", email: "user@example.com", password: "zu-kurz" }, "Passwort"],
  ])("rejects invalid account input", (input, message) => {
    expect(() => parseProvisionedUser(input)).toThrow(message);
  });

  it("resolves direct email login and case-insensitive username login", async () => {
    const store = new MemoryStore();
    store.values.set(usernameIndexKey("ergin.admin"), {
      state: "ready",
      owner: "provisioning-owner",
      userId: "u-1",
      email: "user@example.com",
      username: "ergin.admin",
    });
    await expect(resolveLoginEmail(store, " USER@Example.COM ")).resolves.toBe("user@example.com");
    await expect(resolveLoginEmail(store, " Ergin.Admin ")).resolves.toBe("user@example.com");
  });

  it("fails closed for unknown, invalid, or malformed username records", async () => {
    const store = new MemoryStore();
    store.values.set(usernameIndexKey("broken.user"), { email: "not-an-email" });
    await expect(resolveLoginEmail(store, "unknown.user")).resolves.toBeNull();
    await expect(resolveLoginEmail(store, "bad user")).resolves.toBeNull();
    await expect(resolveLoginEmail(store, "broken.user")).resolves.toBeNull();
  });

  it("binds a username login to the indexed Supabase user and metadata", () => {
    const index = { state: "ready", owner: "provisioning-owner", userId: "u-1", email: "user@example.com", username: "ergin.admin" } as const;
    expect(usernameIdentityMatches(index, { id: "u-1", email: "USER@example.com", user_metadata: { username: "Ergin.Admin" } })).toBe(true);
    expect(usernameIdentityMatches(index, { id: "u-2", email: "user@example.com", user_metadata: { username: "ergin.admin" } })).toBe(false);
    expect(usernameIdentityMatches(index, { id: "u-1", email: "user@example.com", user_metadata: { username: "other.user" } })).toBe(false);
  });

  it("keeps the account blocked until index and audit are ready", async () => {
    const store = new MemoryStore(), calls: string[] = [];
    const result = await provisionDirectUser({
      account: { username: "ergin.admin", email: "user@example.com", password: "Sicheres Passwort 2026!" },
      metadata: { role: "read_only", status: "active", version: 1 },
      actorId: "admin",
      evidence: {},
      store,
      auth: {
        createBlocked: async (attributes) => { calls.push(`create:${attributes.app_metadata.status}:${attributes.ban_duration}`); return { userId: "u-1" }; },
        activate: async () => { calls.push("activate"); },
        block: async () => { calls.push("block"); },
        remove: async () => { calls.push("remove"); },
        exists: async () => false,
      },
      writeAudit: async () => { calls.push("audit"); },
    });
    expect(result.userId).toBe("u-1");
    expect(calls).toEqual(["create:blocked:876000h", "audit", "activate"]);
    expect(await store.get(usernameIndexKey("ergin.admin"))).toMatchObject({ state: "ready", userId: "u-1" });
  });

  it("removes a still-blocked account and index when audit fails", async () => {
    const store = new MemoryStore(), calls: string[] = [];
    await expect(provisionDirectUser({
      account: { username: "ergin.admin", email: "user@example.com", password: "Sicheres Passwort 2026!" },
      metadata: { role: "read_only", status: "active", version: 1 }, actorId: "admin", evidence: {}, store,
      auth: {
        createBlocked: async () => ({ userId: "u-1" }), activate: async () => {},
        block: async () => { calls.push("block"); }, remove: async () => { calls.push("remove"); }, exists: async () => false,
      },
      writeAudit: async () => { throw new Error("audit unavailable"); },
    })).rejects.toThrow("Provisionierung fehlgeschlagen");
    expect(calls).toEqual(["block", "remove"]);
    expect(await store.get(usernameIndexKey("ergin.admin"))).toBeNull();
  });

  it("keeps a failed rollback indexed and blocked as an incident", async () => {
    const store = new MemoryStore(), calls: string[] = [];
    await expect(provisionDirectUser({
      account: { username: "ergin.admin", email: "user@example.com", password: "Sicheres Passwort 2026!" },
      metadata: { role: "read_only", status: "active", version: 1 }, actorId: "admin", evidence: {}, store,
      auth: {
        createBlocked: async () => ({ userId: "u-1" }), activate: async () => { throw new Error("activate"); },
        block: async () => { calls.push("block"); }, remove: async () => { calls.push("remove"); throw new Error("delete"); }, exists: async () => true,
      },
      writeAudit: async () => {},
    })).rejects.toBeInstanceOf(ProvisioningUncertainError);
    expect(calls).toEqual(["block", "remove"]);
    expect(await store.get(usernameIndexKey("ergin.admin"))).toMatchObject({ state: "rollback_required", userId: "u-1" });
  });
});
