import {describe,expect,it} from 'vitest';
import {ALL_PERMISSIONS,can,parseAccessMetadata,filterPartnerRows,foreignScopeRequested,assertMayRemoveSuperAdmin,mayImpersonate,stripFinance,assertMayManageUser,assertMayDelegatePermissions,assertScopesSupported,scopeFingerprint,resolveStoredAccessMetadata} from './rbac';

describe('central RBAC',()=>{
 it('is deny-by-default and exposes the complete permission registry',()=>{
  expect(ALL_PERMISSIONS).toHaveLength(18);
  expect(can(parseAccessMetadata({role:'employee'}),'dashboard.view')).toBe(true);
  expect(can(parseAccessMetadata({role:'employee'}),'settings.manage')).toBe(false);
 });
 it('separates automation configuration from live-write permission',()=>{
  const employee=parseAccessMetadata({role:'employee',status:'active',version:1});
  expect(can(employee,'automations.manage')).toBe(false);
  expect(can(employee,'automations.live')).toBe(false);
  const delegated=parseAccessMetadata({role:'employee',status:'active',version:1,grants:['automations.manage']});
  expect(can(delegated,'automations.manage')).toBe(true);
  expect(can(delegated,'automations.live')).toBe(false);
 });
 it('uses grants minus denials with denial precedence',()=>{
  const access=parseAccessMetadata({role:'employee',grants:['settings.manage','finance.view'],denials:['finance.view']});
  expect(can(access,'settings.manage')).toBe(true);
  expect(can(access,'finance.view')).toBe(false);
 });
 it('rejects malformed metadata and ignores user metadata by API design',()=>{
  expect(parseAccessMetadata({role:'root',grants:['not.real'],status:'active'})).toEqual(parseAccessMetadata({}));
  expect(parseAccessMetadata({role:'partner',scopes:{affiliate_ids:['1'],source:['google'],sub_source:['x']}}).scopes.affiliate).toEqual(['1']);
 });
 it('rejects inherited top-level roles and mismatched stored custom-role identities',()=>{
  const inherited=Object.create({role:'admin'});
  expect(parseAccessMetadata(inherited)).toMatchObject({role:'read_only',status:'blocked'});
  expect(can(parseAccessMetadata(inherited),'settings.manage')).toBe(false);
  const metadata={role:'admin',custom_role:{id:'role-1',baseRole:'admin',grants:[],denials:[],version:1}};
  expect(resolveStoredAccessMetadata(metadata,{id:'different-role',baseRole:'admin',grants:[],denials:[],version:1})).toBeNull();
  expect(resolveStoredAccessMetadata(metadata,{id:'role-1',baseRole:'read_only',grants:[],denials:[],version:2})).toMatchObject({role:'read_only',customRoleId:'role-1',customRole:{baseRole:'read_only',version:2}});
  const scoped={...metadata,scopes:{affiliate:['tenant-a']}};
  const partner=resolveStoredAccessMetadata(scoped,{id:'role-1',baseRole:'partner',grants:[],denials:[],version:3})!;
  expect(partner.role).toBe('partner');
  expect(filterPartnerRows([{affiliate_id:'tenant-a'},{affiliate_id:'tenant-b'}],partner)).toEqual([{affiliate_id:'tenant-a'}]);
 });
 it('applies explicit super-admin denials through ordinary user management',()=>{
  const actor=parseAccessMetadata({role:'super_admin',denials:['finance.view']});
  const requested=parseAccessMetadata({role:'employee',grants:['finance.view']});
  expect(()=>assertMayManageUser({actorId:'super',actor,targetId:'user',target:parseAccessMetadata({role:'employee'}),requested})).toThrow(/Berechtigung/);
 });
 it('filters partner rows before totals, rejects direct foreign IDs, and fails closed without scopes',()=>{
  const access=parseAccessMetadata({role:'partner',scopes:{affiliate:['a'],offer:['o1'],campaign:['c1'],account:['ac'],source:['s'],sub_source:['ss']}});
  const rows=[{affiliate_id:'a',offer_id:'o1',campaign_id:'c1',account_id:'ac',source:'s',sub_source:'ss',revenue:10},{affiliate_id:'b',offer_id:'o1',campaign_id:'c1',account_id:'ac',source:'s',sub_source:'ss',revenue:999}];
  expect(filterPartnerRows(rows,access).reduce((n,r)=>n+r.revenue,0)).toBe(10);
  expect(foreignScopeRequested(access,{affiliate:'b'})).toBe(true);
  expect(filterPartnerRows(rows,parseAccessMetadata({role:'partner',scopes:{}}))).toEqual([]);
 });
 it('removes nested and suffixed financial fields without deleting operational KPIs',()=>{
  const safe=stripFinance({profit30:9,revenue_30d:7,profitEpc:1,payout:4,nested:{saleAmount:3,registrations:2,first_sales:1}},false);
  expect(safe).toEqual({nested:{registrations:2,first_sales:1}});
 });
 it('protects the last super admin',()=>{
  expect(()=>assertMayRemoveSuperAdmin({targetIsSuperAdmin:true,activeSuperAdminCount:1,willRemainActiveSuperAdmin:false})).toThrow(/letzte/i);
  expect(()=>assertMayRemoveSuperAdmin({targetIsSuperAdmin:true,activeSuperAdminCount:2,willRemainActiveSuperAdmin:false})).not.toThrow();
 });
 it('only impersonates strictly lower privilege and preserves finance secrecy',()=>{
  expect(mayImpersonate('admin','employee')).toBe(true);
  expect(mayImpersonate('admin','admin')).toBe(false);
  expect(stripFinance({clicks:1,revenue:9,payout:4,profit:5},false)).toEqual({clicks:1});
 });
 it('lets admins manage roles but never super-admins, themselves, or peers',()=>{
  const admin=parseAccessMetadata({role:'admin'});
  expect(can(admin,'roles.manage')).toBe(true);
  expect(()=>assertMayManageUser({actorId:'a',actor:admin,targetId:'u',target:parseAccessMetadata({role:'employee'}),requested:parseAccessMetadata({role:'partner'})})).not.toThrow();
  expect(()=>assertMayManageUser({actorId:'a',actor:admin,targetId:'a',target:admin,requested:parseAccessMetadata({role:'employee'})})).toThrow(/selbst/i);
  expect(()=>assertMayManageUser({actorId:'a',actor:admin,targetId:'b',target:admin,requested:admin})).toThrow(/gleichrangig/i);
  expect(()=>assertMayManageUser({actorId:'a',actor:admin,targetId:'s',target:parseAccessMetadata({role:'super_admin'}),requested:admin})).toThrow(/Super-Admin/i);
  expect(()=>assertMayManageUser({actorId:'a',actor:admin,targetId:'u',target:parseAccessMetadata({role:'employee'}),requested:parseAccessMetadata({role:'super_admin'})})).toThrow(/Super-Admin/i);
 });
 it('respects explicit denials even for super-admin delegation while allowing all remaining sensitive permissions',()=>{
  const restricted=parseAccessMetadata({role:'super_admin',denials:['finance.view']});
  expect(()=>assertMayDelegatePermissions(restricted,parseAccessMetadata({role:'employee',grants:['finance.view']}))).toThrow(/Berechtigung/);
  expect(()=>assertMayDelegatePermissions(restricted,parseAccessMetadata({role:'admin',denials:['finance.view']}))).not.toThrow();
 });
 it('evaluates a materialized custom role and denies invalid custom permissions',()=>{
  const access=parseAccessMetadata({role:'employee',custom_role:{id:'analyst',baseRole:'read_only',grants:['exports.download','finance.view'],denials:['finance.view'],version:3}});
  expect(access.customRoleId).toBe('analyst');
  expect(can(access,'exports.download')).toBe(true);
  expect(can(access,'finance.view')).toBe(false);
 });
 it('maps provider scope aliases, fingerprints scopes, and strips finance recursively',()=>{
  const access=parseAccessMetadata({role:'partner',scopes:{affiliate:['42'],source:['google']}});
  expect(filterPartnerRows([{affiliate_id:'42',source_id:'google'},{affiliate_id:'42',source_id:'bing'}],access)).toHaveLength(1);
  expect(scopeFingerprint(access)).toBe(scopeFingerprint(parseAccessMetadata({role:'partner',scopes:{source:['google'],affiliate:['42']}})));
  expect(scopeFingerprint(parseAccessMetadata({role:'partner',scopes:{}}))).not.toBe(scopeFingerprint(parseAccessMetadata({role:'admin',scopes:{}})));
  expect(stripFinance({summary:{revenue:9,clicks:1},rows:[{payout:2,name:'x'}]},false)).toEqual({summary:{clicks:1},rows:[{name:'x'}]});
 });
 it('fails closed when a scoped aggregate cannot enforce every populated dimension',()=>{
  const access=parseAccessMetadata({role:'partner',scopes:{affiliate:['42'],source:['google']}});
  expect(()=>assertScopesSupported(access,['affiliate','campaign'])).toThrow(/Scope/);
  expect(()=>assertScopesSupported(access,['affiliate','source'])).not.toThrow();
 });
 it('compares effective permissions and blocks delegated sensitive grants',()=>{
  const delegated=parseAccessMetadata({role:'employee',grants:['users.manage','roles.manage']});
  expect(()=>assertMayManageUser({actorId:'a',actor:delegated,targetId:'u',target:parseAccessMetadata({role:'read_only'}),requested:parseAccessMetadata({role:'read_only',grants:['finance.view']})})).toThrow(/Berechtigung/);
  const admin=parseAccessMetadata({role:'admin'});
  expect(()=>assertMayManageUser({actorId:'a',actor:admin,targetId:'u',target:parseAccessMetadata({role:'employee'}),requested:parseAccessMetadata({role:'employee',grants:['users.manage']})})).toThrow(/sensitiv/i);
 });
});
