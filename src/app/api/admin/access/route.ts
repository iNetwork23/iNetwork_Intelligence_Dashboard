import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin, getSupabasePasswordAuth } from '@/lib/supabase';
import { audit, listAudit, requestEvidence, securityStore } from '@/lib/access-store';
import { currentUser, resolveCurrentUserUncached } from '@/lib/session';
import { ALL_PERMISSIONS, assertMayDelegatePermissions, assertMayManageUser, assertMayRemoveSuperAdmin, can, mayImpersonate, parseAccessMetadata, STANDARD_ROLES, type AccessMetadata, type Permission, type StandardRole } from '@/lib/rbac';
import { canonicalOrigin, checkCsrf, createOpaqueSession, COOKIE_NAME, parseBoundedJson, revokeUserSessions, securityHeaders, withSecurityLock } from '@/lib/security';
import { hasMfa, resetMfa } from '@/lib/mfa';
import { assertRoleIsUnassigned, buildRoleOptions, type CustomRoleDefinition } from '@/lib/admin-access-policy';
import { DuplicateProvisioningIdentityError, parseProvisionedUser, provisionDirectUser, ProvisioningUncertainError } from '@/lib/user-provisioning';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: securityHeaders });
type CustomRole = CustomRoleDefinition;
const object = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const serializeAccess = (access: AccessMetadata) => ({
  role: access.role,
  status: access.status,
  grants: access.grants,
  denials: access.denials,
  scopes: access.scopes,
  version: access.version,
  ...(access.customRole
    ? {
        custom_role: {
          id: access.customRole.id,
          baseRole: access.customRole.baseRole,
          grants: access.customRole.grants,
          denials: access.customRole.denials,
          version: access.customRole.version,
        },
      }
    : {}),
});
async function resolveAccess(raw: unknown, version: number) {
  const parsed = parseAccessMetadata(raw),
    customRoleId = object(raw) && typeof raw.customRoleId === 'string' ? raw.customRoleId.slice(0, 100) : undefined;
  if (!customRoleId) return serializeAccess({ ...parsed, version });
  const saved = (await securityStore().get(`rbac:role:${customRoleId}`)) as CustomRole | null;
  if (!saved || !saved.id || !(saved.baseRole in STANDARD_ROLES)) throw new Error('Unbekannte benutzerdefinierte Rolle');
  return serializeAccess({
    ...parsed,
    role: saved.baseRole,
    version,
    customRoleId: saved.id,
    customRole: {
      id: saved.id,
      baseRole: saved.baseRole,
      grants: saved.grants,
      denials: saved.denials,
      version: saved.version || 1,
    },
  });
}
async function users() {
  const all = [];
  for (let page = 1; ; page++) {
    const result = await getSupabaseAdmin().auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (result.error) throw new Error('users');
    all.push(...result.data.users);
    if (result.data.users.length < 1000) break;
  }
  return all;
}
export async function GET() {
  const actor = await currentUser();
  if (!actor) return json({ error: 'Nicht angemeldet' }, 401);
  const mayUsers = can(actor.access, 'users.manage'),
    mayRoles = can(actor.access, 'roles.manage'),
    mayAudit = can(actor.access, 'audit.view');
  if (!mayUsers && !mayAudit && !mayRoles) return json({ error: 'Keine Berechtigung' }, 403);
  try {
    const response: Record<string, unknown> = {};
    let roleDefinitions: CustomRole[] = [];
    if (mayUsers || mayRoles) {
      response.permissions = ALL_PERMISSIONS;
      roleDefinitions = (await securityStore().list('rbac:role:')).map((x) => x.value as CustomRole);
    }
    if (mayUsers) {
      const all = await users(),
        store = securityStore();
      response.users = await Promise.all(
        all.map(async (u) => ({
          id: u.id,
          email: u.email,
          username: String(u.user_metadata?.username || '').trim() || undefined,
          name: String(u.user_metadata?.full_name || u.user_metadata?.name || '').trim() || undefined,
          status: parseAccessMetadata(u.app_metadata).status,
          access: parseAccessMetadata(u.app_metadata),
          mfaEnabled: await hasMfa(store, u.id),
          lastLogin: u.last_sign_in_at || null,
          createdAt: u.created_at,
        })),
      );
      response.roleOptions = buildRoleOptions(roleDefinitions);
    }
    if (mayRoles) response.standardRoles = STANDARD_ROLES;
    if (mayRoles) response.roles = roleDefinitions;
    if (mayAudit) response.audit = await listAudit();
    return json(response);
  } catch {
    return json({ error: 'Zugriffsdaten konnten nicht geladen werden' }, 500);
  }
}
export async function POST(request: Request) {
  const initialActor = await currentUser();
  if (!initialActor) return json({ error: 'Nicht angemeldet' }, 401);
  let origin: string;
  try {
    origin = canonicalOrigin(process.env.APP_ORIGIN, process.env.NODE_ENV, request.url);
  } catch {
    return json({ error: 'Serverkonfiguration ungültig' }, 500);
  }
  if (!checkCsrf(request, origin)) return json({ error: 'Anfrage abgelehnt' }, 403);
  let input: Record<string, unknown>;
  try {
    input = await parseBoundedJson(request);
  } catch {
    return json({ error: 'Ungültige Anfrage' }, 400);
  }
  const action = String(input.action || ''),
    targetId = String(input.userId || '').slice(0, 100),
    evidence = requestEvidence(request);
  try {
    return await withSecurityLock(securityStore(), 'admin-access-mutation', async () => {
      const actor = await resolveCurrentUserUncached();
      if (!actor || actor.id !== initialActor.id || actor.actorId !== initialActor.actorId)
        return json({ error: 'Berechtigung wurde zwischenzeitlich geändert. Bitte neu anmelden.' }, 403);
    if (action === 'exit_impersonation') {
      if (!actor.impersonating) return json({ error: 'Keine aktive Impersonation' }, 400);
      const { data, error } = await getSupabaseAdmin().auth.admin.getUserById(actor.actorId);
      if (error || !data.user) return json({ error: 'Akteur nicht verfügbar' }, 403);
      const access = parseAccessMetadata(data.user.app_metadata);
      const made = await createOpaqueSession(securityStore(), {
        userId: data.user.id,
        metadataVersion: access.version,
      });
      (await cookies()).set(COOKIE_NAME, made.token, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 43_200,
      });
      await audit({
        actorId: actor.actorId,
        action: 'impersonation.exit',
        targetId: actor.id,
        ...evidence,
      });
      return json({ ok: true });
    }
    if (action === 'impersonate') {
      if (!can(actor.access, 'users.manage')) return json({ error: 'Keine Berechtigung' }, 403);
      const { data, error } = await getSupabaseAdmin().auth.admin.getUserById(targetId);
      if (error || !data.user) return json({ error: 'Benutzer nicht gefunden' }, 404);
      const target = parseAccessMetadata(data.user.app_metadata);
      if (target.status !== 'active' || !mayImpersonate(actor.access.role, target.role)) return json({ error: 'Impersonation nicht erlaubt' }, 403);
      const made = await createOpaqueSession(securityStore(), {
        userId: data.user.id,
        actorId: actor.actorId,
        metadataVersion: target.version,
      });
      (await cookies()).set(COOKIE_NAME, made.token, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 43_200,
      });
      await audit({
        actorId: actor.actorId,
        action: 'impersonation.start',
        targetId,
        ...evidence,
      });
      return json({ ok: true });
    }
    if (action === 'create_user') {
      if (!can(actor.access, 'users.manage')) return json({ error: 'Keine Berechtigung' }, 403);
      let account;
      try {
        account = parseProvisionedUser(input);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Ungültige Anfrage' }, 400);
      }
      const metadata = await resolveAccess(input.access, 1),
        requested = parseAccessMetadata(metadata);
      assertMayManageUser({
        actorId: actor.id,
        actor: actor.access,
        targetId: 'new-user',
        target: parseAccessMetadata({ role: 'read_only' }),
        requested,
      });
      try {
        const supabase = getSupabaseAdmin(),
          result = await provisionDirectUser({
          account,
          metadata,
          actorId: actor.actorId,
          evidence,
          store: securityStore(),
          auth: {
            createBlocked: async (attributes) => {
              const created = await supabase.auth.admin.createUser(attributes);
              if (created.error || !created.data.user) {
                if (/already|registered|exists/i.test(created.error?.message || ''))
                  throw new DuplicateProvisioningIdentityError('Benutzername oder E-Mail ist bereits vergeben.');
                throw new Error('Benutzerkonto konnte nicht angelegt werden.');
              }
              return { userId: created.data.user.id };
            },
            activate: async (userId, attributes) => {
              const updated = await supabase.auth.admin.updateUserById(userId, attributes);
              if (updated.error) throw new Error('Benutzerkonto konnte nicht aktiviert werden.');
            },
            block: async (userId, attributes) => {
              const updated = await supabase.auth.admin.updateUserById(userId, attributes);
              if (updated.error) throw updated.error;
            },
            remove: async (userId) => {
              const removed = await supabase.auth.admin.deleteUser(userId);
              if (removed.error) throw removed.error;
            },
            exists: async (userId) => {
              const current = await supabase.auth.admin.getUserById(userId);
              if (current.error && /not found/i.test(current.error.message)) return false;
              if (current.error) throw current.error;
              return Boolean(current.data.user);
            },
          },
          writeAudit: audit,
        });
        return json({ ok: true, userId: result.userId }, 201);
      } catch (error) {
        if (error instanceof DuplicateProvisioningIdentityError)
          return json({ error: error.message }, 409);
        if (error instanceof ProvisioningUncertainError)
          return json({ error: error.message }, 503);
        throw error;
      }
    }
    if (['reset_password', 'reset_mfa', 'revoke_sessions', 'update_user', 'block', 'reactivate', 'deactivate'].includes(action)) {
      if (!can(actor.access, 'users.manage') && !(action === 'revoke_sessions' && targetId === actor.id)) return json({ error: 'Keine Berechtigung' }, 403);
      const supabase = getSupabaseAdmin(),
        oldResult = await supabase.auth.admin.getUserById(targetId);
      if (oldResult.error || !oldResult.data.user) return json({ error: 'Benutzer nicht gefunden' }, 404);
      const before = parseAccessMetadata(oldResult.data.user.app_metadata);
      if (action === 'revoke_sessions' && targetId === actor.id) {
        await revokeUserSessions(securityStore(), targetId);
        await audit({
          actorId: actor.actorId,
          action: 'session.revoke_all',
          targetId,
          ...evidence,
        });
        return json({ ok: true });
      }
      if (action === 'reset_mfa' || action === 'reset_password' || action === 'revoke_sessions')
        assertMayManageUser({ actorId: actor.id, actor: actor.access, targetId, target: before, requested: before });
      if (action === 'reset_mfa') {
        await resetMfa(securityStore(), targetId);
        await revokeUserSessions(securityStore(), targetId);
        await audit({
          actorId: actor.actorId,
          action: 'user.mfa_reset',
          targetId,
          ...evidence,
        });
        return json({ ok: true });
      }
      if (action === 'reset_password') {
        if (!oldResult.data.user.email) return json({ error: 'Benutzer nicht gefunden' }, 404);
        const reset = await getSupabasePasswordAuth().auth.resetPasswordForEmail(oldResult.data.user.email, { redirectTo: `${origin}/auth/callback` });
        if (reset.error) throw new Error('reset');
        await audit({
          actorId: actor.actorId,
          action: 'user.password_reset',
          targetId,
          ...evidence,
        });
        return json({ ok: true });
      }
      if (action === 'revoke_sessions') {
        await revokeUserSessions(securityStore(), targetId);
        await audit({
          actorId: actor.actorId,
          action: 'session.revoke_all',
          targetId,
          ...evidence,
        });
        return json({ ok: true });
      }
      const freshResult = await supabase.auth.admin.getUserById(targetId);
        if (freshResult.error || !freshResult.data.user) return json({ error: 'Benutzer nicht gefunden' }, 404);
        const current = parseAccessMetadata(freshResult.data.user.app_metadata);
        if (['update_user', 'block', 'reactivate', 'deactivate'].includes(action) && Number(input.expectedVersion) !== current.version)
          return json({ error: 'Der Benutzer wurde zwischenzeitlich geändert. Bitte neu laden.' }, 409);
        const requestedRaw =
            action === 'update_user'
              ? await resolveAccess(input.access, current.version + 1)
              : serializeAccess({
                  ...current,
                  status: action === 'reactivate' ? 'active' : action === 'block' ? 'blocked' : 'deactivated',
                  version: current.version + 1,
                }),
          requested = parseAccessMetadata(requestedRaw);
        assertMayManageUser({ actorId: actor.id, actor: actor.access, targetId, target: current, requested });
        const all = await users(),
          activeSupers = all.filter((u) => {
            const a = parseAccessMetadata(u.app_metadata);
            return a.role === 'super_admin' && a.status === 'active';
          }).length;
        assertMayRemoveSuperAdmin({
          targetIsSuperAdmin: current.role === 'super_admin' && current.status === 'active',
          activeSuperAdminCount: activeSupers,
          willRemainActiveSuperAdmin: requested.role === 'super_admin' && requested.status === 'active',
        });
        const updated = await supabase.auth.admin.updateUserById(targetId, {
          app_metadata: requestedRaw,
        });
        if (updated.error) throw new Error('update');
        await revokeUserSessions(securityStore(), targetId);
        await audit({
          actorId: actor.actorId,
          action: `user.${action}`,
          targetId,
          before: current,
          after: requested,
          ...evidence,
        });
        return json({ ok: true });
    }
    if (['create_role', 'update_role', 'duplicate_role', 'delete_role'].includes(action)) {
      if (!can(actor.access, 'roles.manage')) return json({ error: 'Keine Berechtigung' }, 403);
      const roleId = action === 'update_role' || action === 'delete_role' ? String(input.roleId || '').slice(0, 100) : crypto.randomUUID(),
        existing = roleId ? ((await securityStore().get(`rbac:role:${roleId}`)) as CustomRole | null) : null;
      if (!existing && (action === 'update_role' || action === 'delete_role')) return json({ error: 'Rolle nicht gefunden' }, 404);
      if (existing && (action === 'update_role' || action === 'delete_role') && Number(input.expectedVersion) !== existing.version)
        return json({ error: 'Die Rolle wurde zwischenzeitlich geändert. Bitte neu laden.' }, 409);
      if (existing?.baseRole === 'super_admin' && actor.access.role !== 'super_admin') return json({ error: 'Nur Super-Admins dürfen diese Rolle ändern' }, 403);
      if (action === 'delete_role') {
        if (existing)
          assertMayDelegatePermissions(
            actor.access,
            parseAccessMetadata({
              role: existing.baseRole,
              grants: existing.grants,
              denials: existing.denials,
            }),
          );
        assertRoleIsUnassigned(await users(), roleId);
        await securityStore().delete(`rbac:role:${roleId}`);
        await audit({
          actorId: actor.actorId,
          action: 'role.delete',
          targetId: roleId,
          before: existing,
          ...evidence,
        });
        return json({ ok: true });
      }
      const name = String(input.name || '')
          .trim()
          .slice(0, 80),
        baseRole = (String(input.baseRole || 'read_only') in STANDARD_ROLES ? String(input.baseRole) : 'read_only') as StandardRole;
      if (!name) return json({ error: 'Ungültige Anfrage' }, 400);
      if (baseRole === 'super_admin' && actor.access.role !== 'super_admin')
        return json(
          {
            error: 'Nur Super-Admins dürfen Super-Admin-basierte Rollen erstellen',
          },
          403,
        );
      const grants = (Array.isArray(input.grants) ? input.grants : []).filter((p): p is Permission => (ALL_PERMISSIONS as readonly unknown[]).includes(p)),
        denials = (Array.isArray(input.denials) ? input.denials : []).filter((p): p is Permission => (ALL_PERMISSIONS as readonly unknown[]).includes(p));
      assertMayDelegatePermissions(actor.access, parseAccessMetadata({ role: baseRole, grants, denials }));
      const role: CustomRole = {
        id: roleId,
        name,
        baseRole,
        grants,
        denials,
        version: (existing?.version || 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      await securityStore().set(`rbac:role:${role.id}`, role);
      await audit({
        actorId: actor.actorId,
        action: `role.${action}`,
        targetId: role.id,
        before: existing,
        after: role,
        ...evidence,
      });
      return json({ ok: true, role });
    }
    return json({ error: 'Ungültige Anfrage' }, 400);
    });
  } catch (error) {
    if (error instanceof Error && /(letzte|zugewiesen|läuft)/i.test(error.message)) return json({ error: error.message }, 409);
    if (error instanceof Error && /(selbst|gleichrangig|Super-Admin|Rolle|Berechtigung|sensitiv)/i.test(error.message)) return json({ error: error.message }, 403);
    console.error('Access action failed', error);
    return json({ error: 'Aktion konnte nicht ausgeführt werden' }, 500);
  }
}
