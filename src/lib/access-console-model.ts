export type AccessMetadataSummary = {
  role: string;
  status: string;
  grants: string[];
  denials: string[];
  scopes: Record<string, string[]>;
  customRoleId?: string;
  version?: number;
};
export type AccessUserSummary = {
  id: string;
  email: string;
  username?: string;
  name?: string;
  mfaEnabled?: boolean;
  status: string;
  lastLogin: string | null;
  createdAt?: string;
  access: AccessMetadataSummary;
};
export type AccessFilters = {
  query: string;
  role: string;
  status: string;
  mfa?: string;
};
export type AuditSummary = {
  action: string;
  actorId: string;
  targetId?: string;
};

const roleLabels: Record<string, string> = {
  super_admin: "Super-Admin",
  admin: "Administrator",
  employee: "Mitarbeiter",
  partner: "Partner",
  read_only: "Nur Lesen",
};
const statusLabels: Record<string, string> = {
  active: "Aktiv",
  blocked: "Gesperrt",
  deactivated: "Deaktiviert",
  invited: "Eingeladen",
};
const permissionLabels: Record<string, string> = {
  "dashboard.view": "Dashboard ansehen",
  "partners.view": "Partner ansehen",
  "landingpages.view": "Landingpages ansehen",
  "landingpages.manage": "Landingpages verwalten",
  "settings.manage": "Einstellungen verwalten",
  "smartlinks.edit": "Smartlinks bearbeiten",
  "automations.manage": "Automatisierungen verwalten",
  "automations.live": "Live-Automatisierungen ausführen",
  "statistics.view": "Statistiken ansehen",
  "finance.view": "Finanzkennzahlen ansehen",
  "affiliates.view": "Affiliates ansehen",
  "smartlinks.view": "Smartlinks ansehen",
  "campaigns.view": "Kampagnen ansehen",
  "campaigns.edit": "Kampagnen bearbeiten",
  "automation.view": "Automatisierung ansehen",
  "automation.manage": "Automatisierung verwalten",
  "exports.download": "Daten exportieren",
  "users.manage": "Benutzer verwalten",
  "roles.manage": "Rollen verwalten",
  "audit.view": "Aktivitätsprotokoll ansehen",
  "api.manage": "System-Synchronisierung verwalten",
};

export const roleLabel = (role: string) => roleLabels[role] || role;
export const statusLabel = (status: string) => statusLabels[status] || status;
export const permissionLabel = (permission: string) =>
  permissionLabels[permission] || permission.split(".").join(" · ");
export function permissionGroup(permission: string) {
  if (permission.startsWith("finance")) return "Finanzen";
  if (permission.startsWith("users")) return "Benutzerverwaltung";
  if (permission.startsWith("roles")) return "Rollenverwaltung";
  if (permission.startsWith("smartlinks") || permission.startsWith("campaigns"))
    return "Smartlinks & Kampagnen";
  if (permission.startsWith("affiliate") || permission.startsWith("partners")) return "Affiliates & Partner";
  if (permission.startsWith("automation")) return "Automatisierung";
  if (permission.startsWith("export")) return "Exporte";
  if (permission.startsWith("api") || permission.startsWith("audit"))
    return "System & Sicherheit";
  return "Dashboard & Statistiken";
}
export function filterAccessUsers(
  users: AccessUserSummary[],
  filters: AccessFilters,
) {
  const query = filters.query.trim().toLocaleLowerCase("de");
  return users.filter(
    (user) =>
      (!query ||
        `${user.name || ""} ${user.username || ""} ${user.email}`
          .toLocaleLowerCase("de")
          .includes(query)) &&
      (filters.role === "all" || user.access.role === filters.role) &&
      (filters.status === "all" || user.status === filters.status) &&
      (!filters.mfa ||
        filters.mfa === "all" ||
        (filters.mfa === "enabled" ? user.mfaEnabled : !user.mfaEnabled)),
  );
}
export function auditDescription(event: AuditSummary, targetLabel?: string, locale:'de'|'en'='de') {
  const target = targetLabel || event.targetId || (locale==='en'?'the affected user':'den betroffenen Benutzer');
  const action=event.action==='user.update_user'?'user.update':event.action;
  const messages: Record<string, string> = locale==='en'?{
    "user.create": `${event.actorId} created the account ${target}.`,
    "user.invite": `${event.actorId} invited ${target}.`,
    "user.update": `${event.actorId} changed permissions for ${target}.`,
    "user.block": `${event.actorId} blocked ${target}.`,
    "user.reactivate": `${event.actorId} reactivated ${target}.`,
    "user.deactivate": `${event.actorId} disabled ${target}.`,
    "user.password_reset": `${event.actorId} sent a password reset for ${target}.`,
    "user.mfa_reset": `${event.actorId} reset two-factor authentication for ${target}.`,
    "session.revoke_all": `${event.actorId} ended all sessions for ${target}.`,
    "impersonation.start": `${event.actorId} started viewing as ${target}.`,
    "impersonation.exit": `${event.actorId} left the impersonated user view.`,
    "role.create": `${event.actorId} created a role.`,
    "role.update": `${event.actorId} changed a role.`,
    "role.delete": `${event.actorId} deleted a role.`,
  }:{
    "user.create": `${event.actorId} hat das Benutzerkonto ${target} angelegt.`,
    "user.invite": `${event.actorId} hat ${target} eingeladen.`,
    "user.update": `${event.actorId} hat die Rechte von ${target} geändert.`,
    "user.block": `${event.actorId} hat ${target} gesperrt.`,
    "user.reactivate": `${event.actorId} hat ${target} reaktiviert.`,
    "user.deactivate": `${event.actorId} hat ${target} deaktiviert.`,
    "user.password_reset": `${event.actorId} hat einen Passwort-Reset für ${target} gesendet.`,
    "user.mfa_reset": `${event.actorId} hat die Zwei-Faktor-Anmeldung von ${target} zurückgesetzt.`,
    "session.revoke_all": `${event.actorId} hat alle Sitzungen von ${target} beendet.`,
    "impersonation.start": `${event.actorId} hat die Ansicht von ${target} übernommen.`,
    "impersonation.exit": `${event.actorId} hat die übernommene Benutzeransicht verlassen.`,
    "role.create": `${event.actorId} hat eine neue Rolle erstellt.`,
    "role.update": `${event.actorId} hat eine Rolle geändert.`,
    "role.delete": `${event.actorId} hat eine Rolle gelöscht.`,
  };
  return (
    messages[action] ||
    (locale==='en'?`${event.actorId} performed “${event.action}” for ${target}.`:`${event.actorId} hat „${event.action}“ für ${target} ausgeführt.`)
  );
}
export const actionResultMessage = (action: string) =>
  ({
    create_user: "Benutzerkonto wurde angelegt.",
    invite: "Einladung wurde gesendet.",
    update_user: "Benutzerrechte wurden gespeichert.",
    reset_password: "Passwort-Reset wurde gesendet.",
    reset_mfa: "Zwei-Faktor-Anmeldung wurde zurückgesetzt.",
    revoke_sessions: "Alle Sitzungen wurden beendet.",
    block: "Benutzer wurde gesperrt.",
    reactivate: "Benutzer wurde reaktiviert.",
    deactivate: "Benutzer wurde deaktiviert.",
    create_role: "Rolle wurde erstellt.",
    update_role: "Rolle wurde gespeichert.",
    duplicate_role: "Rolle wurde dupliziert.",
    delete_role: "Rolle wurde gelöscht.",
  })[action] || "Änderung wurde gespeichert.";
