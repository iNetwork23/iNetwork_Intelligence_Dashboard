import { describe, expect, it } from "vitest";
import {
  parseProvisionedUser,
  resolveLoginEmail,
  usernameIndexKey,
} from "./user-provisioning";

class MemoryStore {
  values = new Map<string, unknown>();
  async get(key: string) {
    return this.values.get(key) ?? null;
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
});
