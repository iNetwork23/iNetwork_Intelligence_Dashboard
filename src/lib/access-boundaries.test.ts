import {readFileSync,existsSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const read=(path:string)=>readFileSync(new URL(`../app/${path}`,import.meta.url),'utf8');
describe('wired server authorization boundaries',()=>{
 it('does not require MFA during dashboard login or session validation',()=>{
  const login=read('api/auth/login/route.ts'),session=readFileSync(new URL('./session.ts',import.meta.url),'utf8');
  const page=read('login/page.tsx');
  expect(page).not.toContain('mfa_code');
  expect(page).not.toContain('MFA-Code');
  expect(login).not.toContain('verifyMfaChallenge');
  expect(login).not.toContain('mfaSetupOnly');
  expect(session).not.toContain('await hasMfa');
 });
 it.each([
  ['api/automation/route.ts','campaigns.edit'],
  ['api/cohorts/route.ts','statistics.view'],
  ['api/sync/route.ts','api.manage'],
 ])('%s requires %s and distinguishes 401/403',(file,permission)=>{
  const source=read(file);expect(source).toContain(`requirePermission('${permission}')`);expect(source).toMatch(/status:auth\.status|auth\.status/);
 });
 it.each([
  ['automation/page.tsx','campaigns.edit'],['cohorts/page.tsx','statistics.view'],['smartlinks/page.tsx','smartlinks.view'],
 ])('%s is permission gated on the server',(file,permission)=>expect(read(file)).toContain(`can(user.access,'${permission}')`));
 it('uses an isolated Supabase password client and failure-only rate limiting',()=>{
  const login=read('api/auth/login/route.ts');
  expect(login).toContain('getSupabasePasswordAuth');expect(login).toContain('recordRateLimitFailure');expect(login).toContain('resetRateLimit');expect(login).toContain('canonicalOrigin');
 });
 it('accepts either an email address or a provisioned username in the login form',()=>{
  const login=read('login/page.tsx');
  expect(login).toContain('E-Mail oder Benutzername');
  expect(login).toContain('type="text"');
  expect(login).toContain('autoComplete="username"');
  const route=read('api/auth/login/route.ts');
  expect(route).toContain('resolveLoginIdentity');
  expect(route).toContain('usernameIdentityMatches');
 });
 it('has a scoped, finance-safe, audited export API',()=>{
  expect(existsSync(new URL('../app/api/exports/route.ts',import.meta.url))).toBe(true);
  const source=read('api/exports/route.ts');expect(source).toContain("requirePermission('exports.download')");expect(source).toContain('filterPartnerRows');expect(source).toContain('stripFinance');expect(source).toContain("action:'export.download'");
 });
 it('rejects disabled legacy sessions and configures global security headers',()=>{
  const session=readFileSync(new URL('./session.ts',import.meta.url),'utf8');expect(session).toMatch(/ALLOW_LEGACY_ADMIN.*false/);
  const config=readFileSync(new URL('../../next.config.ts',import.meta.url),'utf8');expect(config).toContain('headers()');expect(config).toContain('Content-Security-Policy');
 });
 it('wires hierarchy guards, custom-role assignment, and isolated resets into user management',()=>{
  const admin=read('api/admin/access/route.ts');expect(admin).toContain('assertMayManageUser');expect(admin).toContain('custom_role');expect(admin).toContain('customRoleId');expect(admin).toContain('getSupabasePasswordAuth');
 });
 it('creates provisioned users fail-closed and activates them only after the index and audit persist',()=>{
  const admin=read('api/admin/access/route.ts');expect(admin).toContain('provisionDirectUser({');expect(admin).toContain('createBlocked:');expect(admin).toContain('activate:');expect(admin).toContain('block:');expect(admin).toContain('exists:');expect(admin).toContain('writeAudit: audit');
 });
 it('keeps the authenticated MFA management lifecycle separate from login',()=>{
  const login=read('api/auth/login/route.ts');expect(login).not.toContain('verifyMfaChallenge');expect(read('api/auth/mfa/route.ts')).toContain('beginMfaEnrollment');
 });
 it('revokes app and Supabase sessions after password setup',()=>{
  const source=read('api/auth/password-setup/route.ts');expect(source).toContain('revokeUserSessions');expect(source).toContain("signOut(input.accessToken,'global')");
 });
 it('partitions admin GET data and preserves custom role assignment in the console',()=>{
  const route=read('api/admin/access/route.ts'),console=read('admin/access/AccessConsole.tsx');
  expect(route).toMatch(/can\(actor\.access,\s*["']users\.manage["']\)/);expect(route).toMatch(/can\(actor\.access,\s*["']roles\.manage["']\)/);expect(route).toMatch(/can\(actor\.access,\s*["']audit\.view["']\)/);
  expect(route).toContain('roleOptions');expect(route).toMatch(/if\s*\(mayRoles\)\s*response\.roles\s*=/);expect(route).toMatch(/if\s*\(mayRoles\)\s*response\.standardRoles\s*=/);expect(console).toContain('data.roleOptions');
  expect(console).toContain('customRoleId');expect(console).toContain("action:'delete_role'");expect(console).toContain('Benutzerdefinierte Rolle');
 });
 it('wires assigned-role protection and an audited, hierarchical MFA reset',()=>{
  const admin=read('api/admin/access/route.ts'),console=read('admin/access/AccessConsole.tsx');
  expect(admin).toContain('assertRoleIsUnassigned');expect(admin).toMatch(/action\s*===\s*["']reset_mfa["']/);expect(admin).toContain('assertMayManageUser');expect(admin).toContain('resetMfa');expect(admin).toContain('revokeUserSessions');expect(admin).toMatch(/action:\s*["']user\.mfa_reset["']/);
  expect(console).toContain("action:'reset_mfa'");expect(console).toMatch(/MFA[\s\S]*wirklich zurücksetzen/i);
 });
 it('gives access forms labels and exposes capability-based security/admin navigation',()=>{
  const console=read('admin/access/AccessConsole.tsx'),shell=read('components/DashboardShell.tsx');
  for(const name of ['create-username','create-email','create-password','create-password-confirm','create-role','custom-role-name','custom-role-base'])expect(console).toContain(name);
  expect(shell).toContain("can(user.access,'users.manage')");expect(shell).toContain("can(user.access,'roles.manage')");expect(shell).toContain("can(user.access,'audit.view')");
 });
 it('provides a global impersonation exit and discoverable MFA security settings',()=>{
  const layout=read('layout.tsx'),sidebar=read('components/AdminSidebar.tsx'),exit=read('api/auth/impersonation/exit/route.ts');expect(layout).toContain('DashboardShell');expect(sidebar).toContain('/api/auth/impersonation/exit');expect(sidebar).toContain('Sicherheit & MFA');expect(exit).toContain("new URL('/',request.url)");expect(exit).toContain("current.actorId==='legacy-admin'");
  expect(existsSync(new URL('../app/settings/security/page.tsx',import.meta.url))).toBe(true);expect(read('settings/security/SecuritySettings.tsx')).toContain('/api/auth/mfa');
 });
 it('serializes every admin mutation and refreshes actor authorization inside the lock',()=>{
  const admin=read('api/admin/access/route.ts'),lock=admin.indexOf("withSecurityLock(securityStore(), 'admin-access-mutation'"),freshActor=admin.indexOf('const actor = await currentUser()',lock),actions=admin.indexOf("if (action === 'exit_impersonation')",freshActor);expect(lock).toBeGreaterThan(-1);expect(freshActor).toBeGreaterThan(lock);expect(actions).toBeGreaterThan(freshActor);expect(lock).toBeLessThan(admin.lastIndexOf('activeSupers'));expect(lock).toBeLessThan(admin.lastIndexOf('freshResult'));expect(admin.lastIndexOf('freshResult')).toBeLessThan(admin.lastIndexOf('expectedVersion'));
 });
 it('ships an explicit owner-conditional incident unlock process',()=>{
  const script=readFileSync(new URL('../../scripts/unlock-admin-access.mjs',import.meta.url),'utf8');expect(script).toContain('CONFIRM_ADMIN_ACCESS_UNLOCK');expect(script).toContain('.eq("value->>owner", owner)');expect(script).toContain('.maybeSingle()');
 });
});
