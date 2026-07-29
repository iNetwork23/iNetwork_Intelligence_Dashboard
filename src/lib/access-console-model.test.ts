import { describe, expect, it } from "vitest";
import {
  auditDescription,
  filterAccessUsers,
  permissionGroup,
  roleLabel,
  statusLabel,
  type AccessUserSummary,
} from "./access-console-model";

const users: AccessUserSummary[] = [
  {
    id: "1",
    email: "anna@firma.de",
    status: "active",
    lastLogin: "2026-07-27T10:00:00Z",
    access: {
      role: "partner",
      status: "active",
      grants: [],
      denials: [],
      scopes: { affiliate: ["32"] },
    },
  },
  {
    id: "2",
    email: "max@firma.de",
    status: "blocked",
    lastLogin: null,
    access: {
      role: "admin",
      status: "blocked",
      grants: ["users.manage"],
      denials: [],
      scopes: {},
    },
  },
];

describe("professional access-console presentation model", () => {
  it("translates technical roles and states into plain German", () => {
    expect(roleLabel("super_admin")).toBe("Super-Admin");
    expect(roleLabel("read_only")).toBe("Nur Lesen");
    expect(statusLabel("blocked")).toBe("Gesperrt");
  });
  it("filters users by search, role and status without changing source data", () => {
    expect(
      filterAccessUsers(users, {
        query: "anna",
        role: "all",
        status: "all",
      }).map((x) => x.id),
    ).toEqual(["1"]);
    expect(
      filterAccessUsers(users, {
        query: "",
        role: "admin",
        status: "blocked",
      }).map((x) => x.id),
    ).toEqual(["2"]);
    expect(users).toHaveLength(2);
  });
  it("finds display names and filters by MFA state", () => {
    const enriched = users.map((user, index) => ({
      ...user,
      name: index === 0 ? "Anna Beispiel" : undefined,
      mfaEnabled: index === 0,
    }));
    expect(
      filterAccessUsers(enriched, {
        query: "anna beispiel",
        role: "all",
        status: "all",
        mfa: "all",
      }),
    ).toHaveLength(1);
    expect(
      filterAccessUsers(enriched, {
        query: "",
        role: "all",
        status: "all",
        mfa: "enabled",
      }),
    ).toHaveLength(1);
  });
  it("finds users by their login username", () => {
    const enriched = users.map((user, index) => ({
      ...user,
      username: index === 0 ? "anna.partner" : undefined,
    }));
    expect(
      filterAccessUsers(enriched, {
        query: "anna.partner",
        role: "all",
        status: "all",
      }),
    ).toHaveLength(1);
  });
  it("groups technical permissions into understandable operational areas", () => {
    expect(permissionGroup("finance.view")).toBe("Finanzen");
    expect(permissionGroup("users.manage")).toBe("Benutzerverwaltung");
    expect(permissionGroup("smartlinks.view")).toBe("Smartlinks & Kampagnen");
  });
  it("renders common audit actions as readable sentences", () => {
    expect(
      auditDescription(
        { action: "user.password_reset", actorId: "ergin", targetId: "u-2" },
        "max@firma.de",
      ),
    ).toBe("ergin hat einen Passwort-Reset für max@firma.de gesendet.");
    expect(
      auditDescription(
        { action: "session.revoke_all", actorId: "ergin", targetId: "u-2" },
        "max@firma.de",
      ),
    ).toBe("ergin hat alle Sitzungen von max@firma.de beendet.");
    expect(
      auditDescription(
        { action: "user.create", actorId: "ergin", targetId: "u-3" },
        "neu@firma.de",
      ),
    ).toBe("ergin hat das Benutzerkonto neu@firma.de angelegt.");
  });
});
