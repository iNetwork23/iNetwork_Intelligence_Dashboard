import {readFileSync,existsSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const read=(path:string)=>readFileSync(new URL(`../app/${path}`,import.meta.url),'utf8');
describe('wired server authorization boundaries',()=>{
 it('uses an uncached actor resolver inside the admin mutation lock',()=>{const session=readFileSync(new URL('./session.ts',import.meta.url),'utf8'),route=read('api/admin/access/route.ts');expect(session).toContain('export async function resolveCurrentUserUncached');expect(route).toContain('resolveCurrentUserUncached()');expect(route).not.toMatch(/withSecurityLock[\s\S]{0,300}const actor = await currentUser\(\)/)});
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
 it('uses an isolated Supabase password client and independent login rate-limit buckets',()=>{
  const login=read('api/auth/login/route.ts');
  expect(login).toContain('getSupabasePasswordAuth');expect(login).toContain('consumeLoginRateLimits');expect(login).not.toContain('Promise.all(rateKeys.map(key=>consumeRateLimit');expect(login).toContain('recordRateLimitFailure');expect(login).toContain('resetRateLimit(store,identityKey)');expect(login).not.toContain('resetRateLimit(store,ipKey)');expect(login).toContain('canonicalOrigin');
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
 it('keeps MFA enrollment disabled consistently with the password-only login policy',()=>{
  const login=read('api/auth/login/route.ts'),mfa=read('api/auth/mfa/route.ts');expect(login).not.toContain('verifyMfaChallenge');expect(mfa).not.toContain('beginMfaEnrollment');expect(mfa).toContain('policy:\'password_only\'');
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
 it('wires assigned-role protection and audited cleanup of legacy MFA data',()=>{
  const admin=read('api/admin/access/route.ts'),console=read('admin/access/AccessConsole.tsx');
  expect(admin).toContain('assertRoleIsUnassigned');expect(admin).toMatch(/action\s*===\s*["']reset_mfa["']/);expect(admin).toContain('assertMayManageUser');expect(admin).toContain('resetMfa');expect(admin).toContain('revokeUserSessions');expect(admin).toMatch(/action:\s*["']user\.mfa_reset["']/);
  expect(console).toContain("action:'reset_mfa'");expect(console).toContain('Legacy-MFA-Daten löschen');
 });
 it('gives access forms labels and exposes capability-based security/admin navigation',()=>{
  const console=read('admin/access/AccessConsole.tsx'),shell=read('components/DashboardShell.tsx');
  for(const name of ['create-username','create-email','create-password','create-password-confirm','create-role','custom-role-name','custom-role-base'])expect(console).toContain(name);
  expect(shell).toContain("can(user.access,'users.manage')");expect(shell).toContain("can(user.access,'roles.manage')");expect(shell).toContain("can(user.access,'audit.view')");
 });
 it('provides a global impersonation exit and a non-enrollable security policy page',()=>{
  const layout=read('layout.tsx'),sidebar=read('components/AdminSidebar.tsx'),exit=read('api/auth/impersonation/exit/route.ts');expect(layout).toContain('DashboardShell');expect(sidebar).toContain('/api/auth/impersonation/exit');expect(sidebar).toContain('Sicherheit');expect(exit).toContain("new URL('/',request.url)");expect(exit).toContain("current.actorId==='legacy-admin'");
  expect(existsSync(new URL('../app/settings/security/page.tsx',import.meta.url))).toBe(true);const settings=read('settings/security/SecuritySettings.tsx'),mfaRoute=read('api/auth/mfa/route.ts');expect(settings).not.toContain('/api/auth/mfa');expect(settings).not.toContain('MFA aktivieren');expect(mfaRoute).not.toContain('beginMfaEnrollment');expect(mfaRoute).toContain('},410)');
 });
 it('serializes every admin mutation and refreshes actor authorization inside the lock',()=>{
  const admin=read('api/admin/access/route.ts'),lock=admin.indexOf("withSecurityLock(securityStore(), 'admin-access-mutation'"),freshActor=admin.indexOf('const actor = await resolveCurrentUserUncached()',lock),actions=admin.indexOf("if (action === 'exit_impersonation')",freshActor);expect(lock).toBeGreaterThan(-1);expect(freshActor).toBeGreaterThan(lock);expect(actions).toBeGreaterThan(freshActor);expect(lock).toBeLessThan(admin.lastIndexOf('activeSupers'));expect(lock).toBeLessThan(admin.lastIndexOf('freshResult'));expect(admin.lastIndexOf('freshResult')).toBeLessThan(admin.lastIndexOf('expectedVersion'));
 });
 it('serializes Campaign pause/resume, rechecks scope, audits, and rolls back audit failures before unlock',()=>{const route=read('api/campaign-status/route.ts'),lock=route.indexOf('withSecurityLock'),scope=route.lastIndexOf('assertVisibleCampaign'),mutation=route.indexOf('setEverflowCampaignStatus',scope),audit=route.indexOf('await audit',mutation),rollback=route.indexOf('setEverflowCampaignStatus',audit);expect(route).toContain("requirePermission('api.manage')");expect(route).toContain("can(access,'campaigns.edit')");expect(route).toContain('checkCsrf');expect(route).toContain('CAMPAIGN_STATUS_UNCLEAR_MANUAL_INTERVENTION');expect(lock).toBeGreaterThan(-1);expect(scope).toBeGreaterThan(lock);expect(mutation).toBeGreaterThan(scope);expect(audit).toBeGreaterThan(mutation);expect(rollback).toBeGreaterThan(audit)});
 it('preserves and authorizes the affiliate context for Smartlink source analysis',()=>{const page=read('smartlinks/page.tsx'),service=readFileSync(new URL('./smartlink-service.ts',import.meta.url),'utf8');expect(page).toContain("foreignScopeRequested(user.access,{campaign:query.campaign,affiliate:query.affiliate})");expect(page).toContain("getSmartlinkInsight(campaignId,user.access,query.refresh==='1',query.affiliate)");expect(service).toContain("foreignScopeRequested(access,{campaign:String(campaignId),affiliate:requestedAffiliateId})");expect(service).toContain("scopedAffiliateId=partnerAffiliateForSmartlink(access),affiliateId=requestedAffiliateId||scopedAffiliateId");expect(service).toContain("String(campaignId),affiliateId||'unscoped',fingerprint");});
 it('rechecks Smartlink source tuples server-side instead of trusting display labels',()=>{const route=read('api/source-blocks/route.ts');expect(route).toContain('originCampaignId');expect(route).toContain('getAffiliateSmartlinks');expect(route).toContain('row.mainValue??null');expect(route).toContain('row.subValue??null')});
 it('ships an explicit owner-conditional incident unlock process',()=>{
  const script=readFileSync(new URL('../../scripts/unlock-admin-access.mjs',import.meta.url),'utf8');expect(script).toContain('CONFIRM_ADMIN_ACCESS_UNLOCK');expect(script).toContain('.eq("value->>owner", owner)');expect(script).toContain('.maybeSingle()');
 });
});
