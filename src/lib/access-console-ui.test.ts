import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import postcss from "postcss";
const source = () =>
  readFileSync(
    new URL("../app/admin/access/AccessConsole.tsx", import.meta.url),
    "utf8",
  );

describe("professional access console contract", () => {
  it("provides task-oriented navigation and a security overview", () => {
    const s = source();
    for (const label of [
      "Übersicht",
      "Benutzer",
      "Rollen & Rechte",
      "Aktivitätsprotokoll",
      "Aufmerksamkeit erforderlich",
    ])
      expect(s).toContain(label);
  });
  it("provides searchable and filterable user management", () => {
    const s = source();
    expect(s).toContain("Benutzer durchsuchen");
    expect(s).toContain("Nach Rolle filtern");
    expect(s).toContain("Nach Status filtern");
    expect(s).toContain("Nach MFA filtern");
    expect(s).toContain("Benutzer anlegen");
    expect(s).toContain('name="username"');
    expect(s).toContain('name="email"');
    expect(s).toContain('name="password"');
    expect(s).toContain('name="passwordConfirm"');
    expect(s).toContain('autoComplete="new-password"');
    expect(s).toContain('action: "create_user"');
  });
  it("loads names and MFA state from the protected admin API", () => {
    const route = readFileSync(
      new URL("../app/api/admin/access/route.ts", import.meta.url),
      "utf8",
    );
    expect(route).toContain("hasMfa");
    expect(route).toContain("mfaEnabled");
    expect(route).toContain("user_metadata");
    expect(route).toContain("username:");
  });
  it("creates a confirmed Supabase user without leaking the password", () => {
    const route = readFileSync(
      new URL("../app/api/admin/access/route.ts", import.meta.url),
      "utf8",
    );
    expect(route).toContain("auth.admin.createUser");
    expect(route).toContain("email_confirm: true");
    expect(route).toContain("app_metadata: metadata");
    expect(route).toContain("user_metadata:");
    expect(route).toContain("usernameIndexKey");
    expect(route).toContain("deleteUser");
    expect(route).not.toContain("inviteUserByEmail");
    const auditStart = route.indexOf("action: 'user.create'"),
      auditEnd = route.indexOf("return json", auditStart);
    expect(auditStart).toBeGreaterThan(-1);
    expect(route.slice(auditStart, auditEnd)).not.toContain("password");
  });
  it("guards stale writes, keeps failed form input and reactivates every inactive account", () => {
    const s = source();
    expect(s).toContain("expectedVersion");
    expect(s).toContain("expectedVersion: user.access.version");
    expect(s).toContain("expectedVersion: role.version");
    expect(s).toContain("event.preventDefault()");
    expect(s).toContain('user.status !== "active"');
  });
  it("keeps generic admin styles scoped away from other settings pages", () => {
    const css = readFileSync(
      new URL("../app/admin-access.css", import.meta.url),
      "utf8",
    );
    expect(css).not.toMatch(/(^|})button\.danger\{/);
    expect(css).toMatch(/\.accessPage button\.danger\s*\{/);
    expect(css).not.toMatch(/(^|})\.emptyState\{/);
    postcss.parse(css).walkRules((rule) => {
      if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name))
        return;
      for (const selector of rule.selectors)
        expect(selector, `unscoped Access selector: ${selector}`).toContain(
          ".accessPage",
        );
    });
    const layout = readFileSync(
      new URL("../app/layout.tsx", import.meta.url),
      "utf8",
    );
    const page = readFileSync(
      new URL("../app/admin/access/page.tsx", import.meta.url),
      "utf8",
    );
    expect(layout).not.toContain("admin-access.css");
    expect(page).toContain("admin-access.css");
    const globals = readFileSync(
      new URL("../app/globals.css", import.meta.url),
      "utf8",
    );
    for (const selector of [
      ".accessConsole",
      ".accessPanel",
      ".permissionGrid",
      ".scopeGrid",
      ".criticalActions",
      ".auditLog",
    ])
      expect(globals).not.toContain(selector);
  });
  it("uses one mutually exclusive permission state instead of conflicting checkboxes", () => {
    const s = source();
    expect(s).toContain("permissionState");
    expect(s).toContain('type="radio"');
    for (const state of [
      "Von Rolle übernommen",
      "Zusätzlich erlaubt",
      "Ausdrücklich verweigert",
    ])
      expect(s).toContain(state);
  });
  it("separates security-critical actions and uses accessible feedback", () => {
    const s = source();
    expect(s).toContain("Sicherheitskritische Aktionen");
    expect(s).toContain('aria-live="polite"');
    expect(s).toContain("aria-busy");
    expect(s).toContain("<dialog");
  });
  it("renders readable audit events with filters and technical details on demand", () => {
    const s = source();
    expect(s).toContain("auditDescription");
    expect(s).toContain("Ereignisse durchsuchen");
    expect(s).toContain("Technische Details");
  });
});
