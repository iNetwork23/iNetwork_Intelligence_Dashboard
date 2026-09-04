"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  actionResultMessage,
  auditDescription,
  filterAccessUsers,
  permissionGroup,
  permissionLabel,
  roleLabel,
  statusLabel,
  type AccessUserSummary,
} from "@/lib/access-console-model";

type Permission = string;
type RoleOption = { id: string; name: string; baseRole: string };
type Role = RoleOption & {
  grants: Permission[];
  denials: Permission[];
  version: number;
};
type User = AccessUserSummary;
type Audit = {
  id: string;
  at: string;
  actorId: string;
  action: string;
  targetId?: string;
};
type Data = {
  standardRoles?: string[];
  permissions?: Permission[];
  users?: User[];
  roleOptions?: RoleOption[];
  roles?: Role[];
  audit?: Audit[];
};
type View = "overview" | "users" | "roles" | "audit";
const views: { id: View; label: string }[] = [
  { id: "overview", label: "Übersicht" },
  { id: "users", label: "Benutzer" },
  { id: "roles", label: "Rollen & Rechte" },
  { id: "audit", label: "Aktivitätsprotokoll" },
];
const scopeKeys = [
  ["affiliate", "Affiliates"],
  ["offer", "Offers"],
  ["campaign", "Kampagnen"],
  ["account", "Accounts"],
  ["source", "Sources"],
  ["sub_source", "Sub-Sources"],
] as const;
const fallbackStandardRoles = [
  "employee",
  "partner",
  "read_only",
];
/** Scope-Vorschau (Etappe 4, Abnahme G): erste Namen je Liste und Entprellung der Eingaben. */
const SCOPE_PREVIEW_NAMES = 10;
const SCOPE_PREVIEW_DEBOUNCE_MS = 400;
type ScopePreviewEntity = { id: string; name: string; sois: number };
type ScopePreviewData = {
  affiliates: ScopePreviewEntity[];
  offers: ScopePreviewEntity[];
  paths: number;
  hidden: { affiliates: number; offers: number };
  scopesApply: boolean;
  unsupported?: Array<"account" | "source" | "sub_source">;
};
// Security contract markers: action:'delete_role' action:'reset_mfa' Benutzerdefinierte Rolle

function PermissionMatrix({
  permissions,
  grants,
  denials,
  prefix = "p",
}: {
  permissions: Permission[];
  grants: Permission[];
  denials: Permission[];
  prefix?: string;
}) {
  const groups = useMemo(
    () => Object.entries(Object.groupBy(permissions, permissionGroup)),
    [permissions],
  );
  const permissionState = (permission: string) =>
    denials.includes(permission)
      ? "deny"
      : grants.includes(permission)
        ? "grant"
        : "inherit";
  return (
    <div className="permissionGroups">
      {groups.map(([group, items]) => (
        <section className="permissionGroup" key={group}>
          <h4>{group}</h4>
          <div className="permissionGrid">
            {(items || []).map((permission) => (
              <fieldset key={permission}>
                <legend>
                  <b>{permissionLabel(permission)}</b>
                  <code>{permission}</code>
                </legend>
                <div
                  className="permissionState"
                  data-state={permissionState(permission)}
                >
                  {[
                    ["inherit", "Von Rolle übernommen"],
                    ["grant", "Zusätzlich erlaubt"],
                    ["deny", "Ausdrücklich verweigert"],
                  ].map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name={`${prefix}:${permission}`}
                        value={value}
                        defaultChecked={permissionState(permission) === value}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
function parsePermissions(fd: FormData, permissions: string[], prefix = "p") {
  return {
    grants: permissions.filter((p) => fd.get(`${prefix}:${p}`) === "grant"),
    denials: permissions.filter((p) => fd.get(`${prefix}:${p}`) === "deny"),
  };
}
function ScopeSummary({ user }: { user: User }) {
  const entries = scopeKeys.flatMap(([key, label]) =>
    (user.access.scopes[key] || []).map((value) => ({ key, label, value })),
  );
  return entries.length ? (
    <div className="scopeChips" aria-label="Aktuelle Datenfreigaben">
      {entries.map((item) => (
        <span key={`${item.key}:${item.value}`}>
          <small>{item.label}</small>
          {item.value}
        </span>
      ))}
    </div>
  ) : (
    <p className="emptyHint">Keine individuellen Datenfreigaben</p>
  );
}
const scopePreviewList = (
  label: string,
  items: ScopePreviewEntity[],
  hidden: number,
) => {
  const shown = items.slice(0, SCOPE_PREVIEW_NAMES),
    rest = items.length - shown.length;
  return (
    <div>
      <span>
        {label} · {items.length}
        {hidden > 0 ? ` (${hidden} ausgeblendet)` : ""}
      </span>
      {shown.length ? (
        <ul>
          {shown.map((item) => (
            <li key={item.id}>
              <b>{item.name}</b>
              <small>
                #{item.id} · {new Intl.NumberFormat("de-DE").format(item.sois)} SOIs
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="emptyHint">Keine sichtbar</p>
      )}
      {rest > 0 && <small>+ {rest} weitere</small>}
    </div>
  );
};
/**
 * Vorschau unter den Scope-Eingaben: liest Rolle und Freigaben aus dem umgebenden Formular (entprellt), fragt die Konsole-Route
 * mit ?preview=1 und zeigt, welche Partner und Offers dieser Zugang sehen würde (Namen und SOIs der letzten 30 Tage, keine Geldwerte).
 */
function ScopePreview({
  user,
  roleOptions,
}: {
  user: User;
  roleOptions: RoleOption[];
}) {
  const host = useRef<HTMLDivElement>(null);
  const fallbackRole = user.access.role;
  const [state, setState] = useState<{
    status: "loading" | "ready" | "error";
    preview?: ScopePreviewData;
    message?: string;
  }>({ status: "loading" });
  useEffect(() => {
    const form = host.current?.closest("form");
    if (!form) return;
    let timer: ReturnType<typeof setTimeout> | undefined,
      controller: AbortController | undefined;
    const run = async () => {
      controller?.abort();
      controller = new AbortController();
      const fd = new FormData(form),
        scopes = Object.fromEntries(
          scopeKeys.map(([key]) => [
            key,
            String(fd.get(`s:${key}`) || "")
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          ]),
        ),
        selection = String(fd.get("role") || fallbackRole),
        role = selection.startsWith("custom:")
          ? roleOptions.find((item) => item.id === selection.slice(7))?.baseRole || fallbackRole
          : selection,
        params = new URLSearchParams({
          preview: "1",
          role,
          scopes: JSON.stringify(scopes),
        });
      setState((current) => ({ ...current, status: "loading" }));
      try {
        const response = await fetch(`/api/admin/access?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok || !body.preview) throw new Error(String(body.error || ""));
        setState({ status: "ready", preview: body.preview as ScopePreviewData });
      } catch (cause) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: cause instanceof Error && cause.message ? cause.message : "",
        });
      }
    };
    // Nur für die aufgeklappte Benutzerkarte rechnen: kein Vorschau-Aufruf je Konto beim Laden der Liste.
    const card = host.current?.closest("details"),
      visible = () => !card || card.open;
    let started = false;
    const start = () => {
      if (started || !visible()) return;
      started = true;
      void run();
    };
    const schedule = () => {
      if (!visible()) return;
      started = true;
      clearTimeout(timer);
      timer = setTimeout(() => void run(), SCOPE_PREVIEW_DEBOUNCE_MS);
    };
    form.addEventListener("input", schedule);
    form.addEventListener("change", schedule);
    card?.addEventListener("toggle", start);
    start();
    return () => {
      clearTimeout(timer);
      controller?.abort();
      form.removeEventListener("input", schedule);
      form.removeEventListener("change", schedule);
      card?.removeEventListener("toggle", start);
    };
  }, [roleOptions, fallbackRole, user.id]);
  const preview = state.preview;
  return (
    <div className="scopePreview" ref={host} aria-live="polite" aria-busy={state.status === "loading"}>
      <span className="sectionKicker">VORSCHAU</span>
      {state.status === "error" && (
        <p className="scopePreviewError" role="alert">
          Vorschau nicht verfügbar{state.message ? ` · ${state.message}` : ""}.
        </p>
      )}
      {preview ? (
        <>
          {preview.unsupported?.length ? (
          <p className="scopePreviewError" role="alert">
            Freigabe {preview.unsupported.join(", ")} wird von den Datenseiten nicht ausgewertet – dort endet dieses Konto mit 403 „Scope kann nicht sicher ausgewertet werden“.
          </p>
        ) : null}
        <p className="scopePreviewSummary">
            <b>
              Vorschau: Dieses Konto sieht {preview.affiliates.length} Partner,{" "}
              {preview.offers.length} Offers
            </b>
            <small>
              {preview.paths} Pfade · Datenbasis: letzte 30 Tage
              {state.status === "loading" ? " · wird aktualisiert …" : ""}
            </small>
          </p>
          {preview.scopesApply && preview.paths === 0 && preview.hidden.affiliates > 0 && (
            <p className="scopePreviewNote">
              Leerer Partner-Scope oder keine passende ID: Dieses Konto sieht keine Partnerdaten.
            </p>
          )}
          {!preview.scopesApply && (
            <p className="scopePreviewNote">
              Datenfreigaben schränken interne Rollen nicht ein; alle Partner bleiben sichtbar.
            </p>
          )}
          <div className="scopePreviewLists">
            {scopePreviewList("Partner", preview.affiliates, preview.hidden.affiliates)}
            {scopePreviewList("Offers", preview.offers, preview.hidden.offers)}
          </div>
        </>
      ) : (
        state.status === "loading" && <p className="emptyHint">Vorschau wird berechnet …</p>
      )}
    </div>
  );
}

export default function AccessConsole() {
  const [data, setData] = useState<Data | null>(null),
    [message, setMessage] = useState(""),
    [loadError, setLoadError] = useState(false),
    [pendingAction, setPendingAction] = useState(""),
    [view, setView] = useState<View>("overview"),
    [query, setQuery] = useState(""),
    [roleFilter, setRoleFilter] = useState("all"),
    [statusFilter, setStatusFilter] = useState("all"),
    [auditQuery, setAuditQuery] = useState(""),
    [auditAction, setAuditAction] = useState("all");
  const createUserDialog = useRef<HTMLDialogElement>(null);
  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const response = await fetch("/api/admin/access", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setData(await response.json());
    } catch {
      setLoadError(true);
      setMessage("Zugriffsdaten konnten nicht geladen werden.");
    }
  }, []);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get(
      "view",
    ) as View | null;
    if (views.some((item) => item.id === requested)) setView(requested!);
    void load();
  }, [load]);
  function selectView(next: View) {
    setView(next);
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.replaceState(null, "", url);
  }
  async function act(payload: Record<string, unknown>, critical?: string) {
    if (critical && !window.confirm(critical)) return false;
    const action = String(payload.action || "");
    setPendingAction(action);
    setMessage("");
    try {
      const response = await fetch("/api/admin/access", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }),
        body = await response.json();
      if (!response.ok) {
        setMessage(String(body.error || "Aktion fehlgeschlagen."));
        return false;
      }
      setMessage(actionResultMessage(action));
      if (action === "impersonate") {
        window.location.assign("/");
        return true;
      }
      await load();
      return true;
    } catch {
      setMessage(
        "Die Aktion konnte nicht ausgeführt werden. Bitte erneut versuchen.",
      );
      return false;
    } finally {
      setPendingAction("");
    }
  }
  const roleAccess = (
    selection: FormDataEntryValue | null,
    fallbackRole = "employee",
  ) => {
    const value = String(selection || fallbackRole);
    if (!value.startsWith("custom:")) return { role: value };
    const customRoleId = value.slice(7),
      role = data?.roleOptions?.find((item) => item.id === customRoleId);
    return { role: role?.baseRole || fallbackRole, customRoleId };
  };
  if (!data) {
    return (
      <div className="accessLoading" aria-live="polite">
        {loadError ? (
          <div className="accessError">
            <strong>Laden fehlgeschlagen</strong>
            <p>{message}</p>
            <button onClick={() => void load()}>Erneut versuchen</button>
          </div>
        ) : (
          <>
            <span />
            <span />
            <span />
            <p>Benutzer und Rechte werden geladen …</p>
          </>
        )}
      </div>
    );
  }
  const permissions = data.permissions || [],
    standardRoles = data.standardRoles || fallbackStandardRoles,
    users = data.users || [],
    roles = data.roles || [],
    roleOptions = data.roleOptions || roles;
  const roleChoices = (currentId?: string) => (
    <>
      {standardRoles.map((role) => (
        <option key={role} value={role}>
          {roleLabel(role)}
        </option>
      ))}
      {currentId && !roleOptions.some((role) => role.id === currentId) && (
        <option value={`custom:${currentId}`}>
          Eigene Rolle · aktuelle Zuweisung
        </option>
      )}
      {roleOptions.map((role) => (
        <option key={role.id} value={`custom:${role.id}`}>
          Eigene Rolle · {role.name}
        </option>
      ))}
    </>
  );
  const filteredUsers = filterAccessUsers(users, {
    query,
    role: roleFilter,
    status: statusFilter,
    mfa: "all",
  });
  const userById = new Map(users.map((user) => [user.id, user.email]));
  const filteredAudit = (data.audit || []).filter(
    (event) =>
      (auditAction === "all" || event.action === auditAction) &&
      (!auditQuery ||
        auditDescription(event, userById.get(event.targetId || ""))
          .toLocaleLowerCase("de")
          .includes(auditQuery.toLocaleLowerCase("de"))),
  );
  const stats = [
    ["Benutzer insgesamt", users.length],
    ["Aktive Benutzer", users.filter((u) => u.status === "active").length],
    ["Gesperrt", users.filter((u) => u.status === "blocked").length],
    [
      "Administratoren",
      users.filter((u) => ["admin", "super_admin"].includes(u.access.role))
        .length,
    ],
    ["Partner", users.filter((u) => u.access.role === "partner").length],
    ["Noch nie angemeldet", users.filter((u) => !u.lastLogin).length],
  ];
  const attention = [
    ...users
      .filter((u) => !u.lastLogin)
      .map((u) => ({
        level: "neutral",
        title: "Einrichtung noch offen",
        text: `${u.email} hat sich noch nie angemeldet.`,
        target: "users" as View,
      })),
    ...users
      .filter(
        (u) =>
          u.access.role === "partner" &&
          !Object.values(u.access.scopes).some((values) => values.length),
      )
      .map((u) => ({
        level: "warning",
        title: "Partner ohne Datenfreigabe",
        text: `${u.email} sieht aufgrund des leeren Scopes keine Partnerdaten.`,
        target: "users" as View,
      })),
    ...users
      .filter((u) => u.status === "blocked")
      .map((u) => ({
        level: "danger",
        title: "Benutzer gesperrt",
        text: `${u.email} kann sich aktuell nicht anmelden.`,
        target: "users" as View,
      })),
  ].slice(0, 8);
  return (
    <div className="accessConsole" aria-busy={Boolean(pendingAction)}>
      <div className="accessToolbar">
        <nav className="accessTabs" aria-label="Bereiche">
          {views
            .filter((item) => item.id !== "users" || data.users)
            .filter((item) => item.id !== "roles" || data.roles)
            .filter((item) => item.id !== "audit" || data.audit)
            .map((item) => (
              <button
                key={item.id}
                className={view === item.id ? "active" : ""}
                aria-current={view === item.id ? "page" : undefined}
                onClick={() => selectView(item.id)}
              >
                {item.label}
              </button>
            ))}
        </nav>
        {data.users && (
          <button
            className="accessPrimary"
            onClick={() => createUserDialog.current?.showModal()}
          >
            Benutzer anlegen
          </button>
        )}
      </div>
      <p
        className={message ? "accessToast visible" : "accessToast"}
        role="status"
        aria-live="polite"
      >
        {message}
      </p>
      {view === "overview" && (
        <section className="accessView" aria-labelledby="access-overview">
          <div className="sectionHeading">
            <div>
              <span className="sectionKicker">SICHERHEIT AUF EINEN BLICK</span>
              <h2 id="access-overview">Übersicht</h2>
              <p>Konten, Zugriffe und offene Sicherheitsaufgaben.</p>
            </div>
          </div>
          <div className="accessStats">
            {stats.map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <section className="accessPanel attentionPanel">
            <div className="panelHeading">
              <div>
                <h3>Aufmerksamkeit erforderlich</h3>
                <p>
                  Konten, die geprüft oder fertig eingerichtet werden sollten.
                </p>
              </div>
              <span className="countBadge">{attention.length}</span>
            </div>
            {attention.length ? (
              <div className="attentionList">
                {attention.map((item, index) => (
                  <button
                    key={`${item.title}-${index}`}
                    className={item.level}
                    onClick={() => selectView(item.target)}
                  >
                    <span className="attentionDot" />
                    <span>
                      <b>{item.title}</b>
                      <small>{item.text}</small>
                    </span>
                    <span>Prüfen →</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="emptyState">
                <strong>Alles in Ordnung</strong>
                <p>Aktuell gibt es keine auffälligen Kontozustände.</p>
              </div>
            )}
          </section>
        </section>
      )}
      {view === "users" && data.users && (
        <section className="accessView" aria-labelledby="access-users">
          <div className="sectionHeading">
            <div>
              <span className="sectionKicker">KONTEN & DATENZUGRIFF</span>
              <h2 id="access-users">Benutzer</h2>
              <p>
                {filteredUsers.length} von {users.length} Konten werden
                angezeigt.
              </p>
            </div>
          </div>
          <div className="accessFilters">
            <label>
              <span>Benutzer durchsuchen</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name oder E-Mail"
              />
            </label>
            <label>
              <span>Nach Rolle filtern</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">Alle Rollen</option>
                {standardRoles.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Nach Status filtern</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Alle Status</option>
                <option value="active">Aktiv</option>
                <option value="blocked">Gesperrt</option>
                <option value="deactivated">Deaktiviert</option>
              </select>
            </label>

          </div>
          <div className="accessUsers">
            {filteredUsers.map((user) => (
              <details key={user.id} className="userCard">
                <summary>
                  <span className="avatar" aria-hidden="true">
                    {(user.name || user.username || user.email).slice(0, 2).toUpperCase()}
                  </span>
                  <span className="userIdentity">
                    <b>{user.name || user.username || user.email}</b>
                    {(user.name || user.username) && <small>{user.email}</small>}
                    <small>
                      Letzte Anmeldung:{" "}
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleString("de-DE")
                        : "noch nie"}
                    </small>
                  </span>
                  <span className={`statusBadge ${user.status}`}>
                    {statusLabel(user.status)}
                  </span>
                  <strong>
                    {roleOptions.find(
                      (role) => role.id === user.access.customRoleId,
                    )?.name || roleLabel(user.access.role)}
                  </strong>

                  <span className="summaryChevron" aria-hidden="true">
                    ›
                  </span>
                </summary>
                <div className="userDetail">
                  <div className="detailIntro">
                    <div>
                      <span className="sectionKicker">ZUGRIFFSPROFIL</span>
                      <h3>{user.name || user.email}</h3>
                      <p>
                        {user.name && `${user.email} · `}
                        {roleLabel(user.access.role)} ·{" "}
                        {user.access.grants.length} zusätzliche Erlaubnisse ·{" "}
                        {user.access.denials.length} ausdrückliche
                        Verweigerungen
                      </p>
                    </div>
                    <ScopeSummary user={user} />
                  </div>
                  <form
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const fd = new FormData(event.currentTarget);
                      const permissionAccess = parsePermissions(
                          fd,
                          permissions,
                        ),
                        scopes = Object.fromEntries(
                          scopeKeys.map(([key]) => [
                            key,
                            String(fd.get(`s:${key}`) || "")
                              .split(",")
                              .map((value) => value.trim())
                              .filter(Boolean),
                          ]),
                        );
                      await act(
                        {
                          action: "update_user",
                          userId: user.id,
                          expectedVersion: user.access.version,
                          access: {
                            ...roleAccess(fd.get("role"), user.access.role),
                            status: user.status,
                            ...permissionAccess,
                            scopes,
                          },
                        },
                        `Rechte von ${user.email} wirklich ändern? Alle bestehenden Sitzungen werden sofort beendet.`,
                      );
                    }}
                  >
                    <section className="detailSection">
                      <h4>Rolle</h4>
                      <label className="fieldLabel">
                        Zugewiesene Rolle
                        <select
                          name="role"
                          defaultValue={
                            user.access.customRoleId
                              ? `custom:${user.access.customRoleId}`
                              : user.access.role
                          }
                        >
                          {roleChoices(user.access.customRoleId)}
                        </select>
                      </label>
                    </section>
                    <section className="detailSection">
                      <div className="detailSectionHeading">
                        <div>
                          <h4>Zusätzliche Rechte</h4>
                          <p>
                            Abweichungen von der gewählten Rolle. Pro Recht ist
                            nur ein Zustand möglich.
                          </p>
                        </div>
                      </div>
                      <PermissionMatrix
                        permissions={permissions}
                        grants={user.access.grants}
                        denials={user.access.denials}
                      />
                    </section>
                    <section className="detailSection">
                      <div className="detailSectionHeading">
                        <div>
                          <h4>Datenzugriff</h4>
                          <p>
                            Mehrere IDs mit Komma trennen. Ein leerer
                            Partner-Scope gewährt keinen Zugriff.
                          </p>
                        </div>
                      </div>
                      <div className="scopeGrid">
                        {scopeKeys.map(([key, label]) => (
                          <label key={key}>
                            <span>{label}</span>
                            <input
                              name={`s:${key}`}
                              defaultValue={
                                user.access.scopes[key]?.join(", ") || ""
                              }
                              placeholder={`${label}-IDs, kommasepariert`}
                            />
                          </label>
                        ))}
                      </div>
                      <ScopePreview user={user} roleOptions={roleOptions} />
                    </section>
                    <div className="formFooter">
                      <p>
                        Beim Speichern werden aus Sicherheitsgründen alle
                        Sitzungen dieses Benutzers beendet.
                      </p>
                      <button
                        className="accessPrimary"
                        disabled={Boolean(pendingAction)}
                      >
                        {pendingAction === "update_user"
                          ? "Speichert …"
                          : "Rechte speichern"}
                      </button>
                    </div>
                  </form>
                  <section className="securityActions">
                    <div>
                      <span className="sectionKicker">SICHERHEIT</span>
                      <h4>Sicherheitskritische Aktionen</h4>
                      <p>
                        Diese Aktionen wirken sofort und können bestehende
                        Sitzungen beenden.
                      </p>
                    </div>
                    <div className="criticalActions">
                      <button
                        onClick={() =>
                          void act(
                            { action: "reset_password", userId: user.id },
                            `Passwort-Reset an ${user.email} senden?`,
                          )
                        }
                      >
                        Passwort zurücksetzen
                      </button>
                      <button
                        onClick={() =>
                          void act(
                            { action: "revoke_sessions", userId: user.id },
                            `Wirklich alle Sitzungen von ${user.email} beenden?`,
                          )
                        }
                      >
                        Sitzungen widerrufen
                      </button>
                      <button
                        onClick={() =>
                          void act(
                            { action: "impersonate", userId: user.id },
                            `Zur Ansicht von ${user.email} wechseln? Aktionen erfolgen im Namen dieses Benutzers.`,
                          )
                        }
                      >
                        Ansicht übernehmen
                      </button>
                      {user.mfaEnabled && <button
                        className="danger"
                        onClick={() =>
                          void act(
                            { action: "reset_mfa", userId: user.id },
                            `Legacy-MFA-Daten von ${user.email} wirklich löschen? Der alte Faktor wird entfernt und alle Sitzungen werden beendet.`,
                          )
                        }
                      >
                        Legacy-MFA-Daten löschen
                      </button>}
                      <button
                        className="danger"
                        onClick={() =>
                          void act(
                            {
                              action:
                                user.status !== "active"
                                  ? "reactivate"
                                  : "block",
                              userId: user.id,
                              expectedVersion: user.access.version,
                            },
                            user.status !== "active"
                              ? `${user.email} wieder aktivieren?`
                              : `${user.email} sofort sperren? Bestehende Sitzungen werden beendet.`,
                          )
                        }
                      >
                        {user.status !== "active"
                          ? "Reaktivieren"
                          : "Benutzer sperren"}
                      </button>
                      {user.status === "active" && (
                        <button
                          className="danger"
                          onClick={() =>
                            void act(
                              {
                                action: "deactivate",
                                userId: user.id,
                                expectedVersion: user.access.version,
                              },
                              `${user.email} wirklich deaktivieren? Der Zugang bleibt gesperrt, bis ein Administrator ihn reaktiviert.`,
                            )
                          }
                        >
                          Deaktivieren
                        </button>
                      )}
                    </div>
                  </section>
                </div>
              </details>
            ))}
            {!filteredUsers.length && (
              <div className="emptyState">
                <strong>Keine Benutzer gefunden</strong>
                <p>Ändere die Suche oder Filterauswahl.</p>
              </div>
            )}
          </div>
        </section>
      )}
      {view === "roles" && data.roles && (
        <section className="accessView" aria-labelledby="access-roles">
          <div className="sectionHeading">
            <div>
              <span className="sectionKicker">
                WIEDERVERWENDBARE ZUGRIFFSPROFILE
              </span>
              <h2 id="access-roles">Rollen &amp; Rechte</h2>
              <p>
                Standardrollen bleiben geschützt. Eigene Rollen können sicher
                angepasst werden.
              </p>
            </div>
          </div>
          <section className="accessPanel createRolePanel">
            <h3>Eigene Rolle erstellen</h3>
            <form
              className="accessInline"
              onSubmit={async (event) => {
                event.preventDefault();
                const fd = new FormData(event.currentTarget);
                await act({
                  action: "create_role",
                  name: fd.get("name"),
                  baseRole: fd.get("baseRole"),
                  grants: [],
                  denials: [],
                });
              }}
            >
              <label htmlFor="custom-role-name">
                Rollenname
                <input
                  id="custom-role-name"
                  name="name"
                  placeholder="z. B. Partner Manager"
                  required
                />
              </label>
              <label htmlFor="custom-role-base">
                Basisrolle
                <select id="custom-role-base" name="baseRole" defaultValue="read_only">
                  {standardRoles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>
              <button className="accessPrimary">Rolle erstellen</button>
            </form>
          </section>
          <div className="customRoles">
            {roles.map((role) => (
              <details key={role.id} className="roleCard">
                <summary>
                  <span>
                    <b>{role.name}</b>
                    <small>Basis: {roleLabel(role.baseRole)}</small>
                  </span>
                  <span>
                    {role.grants.length} erlaubt · {role.denials.length}{" "}
                    verweigert
                  </span>
                  <span className="summaryChevron">›</span>
                </summary>
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const fd = new FormData(event.currentTarget);
                    const permissionAccess = parsePermissions(
                      fd,
                      permissions,
                      `r-${role.id}`,
                    );
                    await act({
                      action: "update_role",
                      roleId: role.id,
                      expectedVersion: role.version,
                      name: fd.get("name"),
                      baseRole: fd.get("baseRole"),
                      ...permissionAccess,
                    });
                  }}
                >
                  <div className="accessInline">
                    <label htmlFor={`role-name-${role.id}`}>
                      Rollenname
                      <input
                        id={`role-name-${role.id}`}
                        name="name"
                        defaultValue={role.name}
                      />
                    </label>
                    <label htmlFor={`role-base-${role.id}`}>
                      Basisrolle
                      <select
                        id={`role-base-${role.id}`}
                        name="baseRole"
                        defaultValue={role.baseRole}
                      >
                        {standardRoles.map((value) => (
                          <option key={value} value={value}>
                            {roleLabel(value)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button>Rolle speichern</button>
                    <button
                      type="button"
                      onClick={() =>
                        void act({
                          action: "duplicate_role",
                          name: `${role.name} Kopie`,
                          baseRole: role.baseRole,
                          grants: role.grants,
                          denials: role.denials,
                        })
                      }
                    >
                      Duplizieren
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() =>
                        void act(
                          {
                            action: "delete_role",
                            roleId: role.id,
                            expectedVersion: role.version,
                          },
                          `Rolle „${role.name}“ wirklich löschen? Zugewiesene Rollen können nicht gelöscht werden.`,
                        )
                      }
                    >
                      Löschen
                    </button>
                  </div>
                  <PermissionMatrix
                    permissions={permissions}
                    grants={role.grants}
                    denials={role.denials}
                    prefix={`r-${role.id}`}
                  />
                </form>
              </details>
            ))}
            {!roles.length && (
              <div className="emptyState">
                <strong>Noch keine eigenen Rollen</strong>
                <p>Erstelle eine Rolle für wiederkehrende Zugriffsmuster.</p>
              </div>
            )}
          </div>
        </section>
      )}
      {view === "audit" && data.audit && (
        <section className="accessView" aria-labelledby="access-audit">
          <div className="sectionHeading">
            <div>
              <span className="sectionKicker">NACHVOLLZIEHBARE ÄNDERUNGEN</span>
              <h2 id="access-audit">Aktivitätsprotokoll</h2>
              <p>
                Nur lesbar · sicherheitsrelevante Ereignisse und
                Zugriffsänderungen.
              </p>
            </div>
          </div>
          <div className="accessFilters auditFilters">
            <label>
              <span>Ereignisse durchsuchen</span>
              <input
                type="search"
                value={auditQuery}
                onChange={(e) => setAuditQuery(e.target.value)}
                placeholder="Benutzer oder Aktion"
              />
            </label>
            <label>
              <span>Nach Aktion filtern</span>
              <select
                value={auditAction}
                onChange={(e) => setAuditAction(e.target.value)}
              >
                <option value="all">Alle Aktionen</option>
                {Array.from(
                  new Set((data.audit || []).map((event) => event.action)),
                )
                  .sort()
                  .map((action) => (
                    <option key={action}>{action}</option>
                  ))}
              </select>
            </label>
          </div>
          <div className="auditLog">
            {filteredAudit.map((event) => (
              <article key={event.id}>
                <span
                  className={`auditIcon ${event.action.includes("failed") || event.action.includes("block") ? "danger" : ""}`}
                  aria-hidden="true"
                />
                <div>
                  <b>
                    {auditDescription(
                      event,
                      userById.get(event.targetId || ""),
                    )}
                  </b>
                  <small>{new Date(event.at).toLocaleString("de-DE")}</small>
                  <details>
                    <summary>Technische Details</summary>
                    <dl>
                      <div>
                        <dt>Aktion</dt>
                        <dd>{event.action}</dd>
                      </div>
                      <div>
                        <dt>Akteur</dt>
                        <dd>{event.actorId}</dd>
                      </div>
                      <div>
                        <dt>Ziel</dt>
                        <dd>{event.targetId || "–"}</dd>
                      </div>
                      <div>
                        <dt>Ereignis-ID</dt>
                        <dd>{event.id}</dd>
                      </div>
                    </dl>
                  </details>
                </div>
              </article>
            ))}
            {!filteredAudit.length && (
              <div className="emptyState">
                <strong>Keine Ereignisse gefunden</strong>
                <p>Ändere Suche oder Aktionsfilter.</p>
              </div>
            )}
          </div>
        </section>
      )}
      <dialog
        ref={createUserDialog}
        className="accessDialog"
        aria-labelledby="create-user-title"
      >
        <form method="dialog" className="dialogClose">
          <button aria-label="Dialog schließen">×</button>
        </form>
        <div className="dialogHeading">
          <span className="sectionKicker">NEUER ZUGANG</span>
          <h2 id="create-user-title">Benutzer anlegen</h2>
          <p>
            Lege die Zugangsdaten direkt fest. Danach kann sich die Person mit
            Benutzername oder E-Mail über den normalen Login anmelden.
          </p>
        </div>
        <form
          className="inviteForm"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget,
              fd = new FormData(form),
              password = String(fd.get("password") || ""),
              passwordConfirm = String(fd.get("passwordConfirm") || "");
            if (password !== passwordConfirm) {
              setMessage("Die beiden Passwörter stimmen nicht überein.");
              return;
            }
            const ok = await act({
              action: "create_user",
              username: fd.get("username"),
              email: fd.get("email"),
              password,
              access: {
                ...roleAccess(fd.get("role")),
                status: "active",
                grants: [],
                denials: [],
                scopes: {},
              },
            });
            if (ok) {
              form.reset();
              createUserDialog.current?.close();
            }
          }}
        >
          <label htmlFor="create-username">
            Benutzername
            <input
              id="create-username"
              name="username"
              type="text"
              placeholder="vorname.nachname"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              minLength={3}
              maxLength={40}
              pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,39}"
              required
            />
          </label>
          <label htmlFor="create-email">
            E-Mail-Adresse
            <input
              id="create-email"
              name="email"
              type="email"
              placeholder="name@firma.de"
              autoComplete="email"
              required
            />
          </label>
          <label htmlFor="create-password">
            Startpasswort
            <input
              id="create-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          <label htmlFor="create-password-confirm">
            Startpasswort wiederholen
            <input
              id="create-password-confirm"
              name="passwordConfirm"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          <label htmlFor="create-role">
            Rolle
            <select id="create-role" name="role" defaultValue="employee">
              {roleChoices()}
            </select>
          </label>
          <div className="inviteSummary">
            Das Passwort wird nicht gespeichert oder später angezeigt. Teile
            Login-Link und Startpasswort über einen sicheren Kanal. Die Rolle
            und Datenfreigaben können anschließend angepasst werden.
          </div>
          <div className="dialogActions">
            <button type="button" onClick={() => createUserDialog.current?.close()}>
              Abbrechen
            </button>
            <button className="accessPrimary" disabled={Boolean(pendingAction)}>
              {pendingAction === "create_user" ? "Legt an …" : "Benutzer anlegen"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
