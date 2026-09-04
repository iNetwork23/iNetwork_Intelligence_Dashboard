import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';
import{assertFraudAccess}from'./fraud-service';
import type{AccessMetadata}from'./rbac';
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('fraud dashboard security and shadow-mode contract',()=>{
 const scopes=()=>({affiliate:[],offer:[],campaign:[],account:[],source:[],sub_source:[]});
 const access=(patch:Partial<AccessMetadata>={}):AccessMetadata=>({role:'super_admin',status:'active',grants:[],denials:[],scopes:scopes(),version:1,...patch});
 it('allows accountwide aggregation for unscoped internal roles with both block rights (D2) and rejects every scoped role, partner and read_only',()=>{
  expect(()=>assertFraudAccess(access())).not.toThrow();
  expect(()=>assertFraudAccess(access({role:'admin'}))).not.toThrow();
  expect(()=>assertFraudAccess(access({role:'employee',grants:['landingpages.manage','api.manage']}))).not.toThrow();
  expect(()=>assertFraudAccess(access({denials:['finance.view']}))).not.toThrow();
  for(const role of ['employee','partner','read_only']as const)expect(()=>assertFraudAccess(access({role}))).toThrow(/403/);
  expect(()=>assertFraudAccess(access({role:'partner',grants:['landingpages.manage','api.manage']}))).toThrow(/403/);
  for(const denial of ['landingpages.manage','api.manage','statistics.view']as const)expect(()=>assertFraudAccess(access({denials:[denial]}))).toThrow(/403/);
  for(const key of Object.keys(scopes())as Array<keyof AccessMetadata['scopes']>)for(const role of ['super_admin','admin']as const)expect(()=>assertFraudAccess(access({role,scopes:{...scopes(),[key]:['restricted']}}))).toThrow(/403/);
  const service=read('src/lib/fraud-service.ts');expect(service).toContain('scopeFingerprint(access)');
 });
 it('keeps detection separate from provider source mutations: the fraud path itself never writes to Everflow, the row block control is rendered by the page only',()=>{
  const service=read('src/lib/fraud-service.ts'),control=read('src/lib/fraud-control.ts'),page=read('src/app/fraud/page.tsx'),cell=read('src/app/fraud/FraudBlockCell.tsx');
  for(const source of[service,control]){expect(source).not.toContain('SourceBlockButton');expect(source).not.toContain('everflow-source-blocks');expect(source).not.toContain('activateEverflowSourceBlock');expect(source).not.toContain('deactivateEverflowSourceBlock');expect(source).not.toContain('source-block-service')}
  for(const source of[page,cell]){expect(source).not.toContain('everflow-source-blocks');expect(source).not.toContain('activateEverflowSourceBlock');expect(source).not.toContain('activateSourceBlock(')}
  expect(page).toContain('<FraudBlockCell');expect(cell).toContain('<SourceBlockButton');
 });
 it('rejects partners and scoped roles and requires statistics plus both block rights before loading account aggregates; finance only gates money columns',()=>{
  const page=read('src/app/fraud/page.tsx'),service=read('src/lib/fraud-service.ts'),gate=read('src/lib/fraud-access.ts'),shell=read('src/app/components/DashboardShell.tsx');
  expect(page).toContain('if(!canAccessFraud(user.access))');expect(page).toContain("can(user.access,'finance.view')");expect(page).toContain("can(user.access,'landingpages.manage')&&can(user.access,'api.manage')");
  expect(service).toContain('if(!canAccessFraud(access))');expect(shell).toContain('const mayFraud=canAccessFraud(user.access)');
  expect(gate).toContain("access.role!=='partner'");expect(gate).toContain('values.length===0');for(const permission of ['statistics.view','landingpages.manage','api.manage'])expect(gate).toContain(`can(access,'${permission}')`);expect(gate).not.toContain("can(access,'finance.view')");
 });
 it('keeps the monitor fail-closed until the versioned conversion cutover is ready',()=>{const service=read('src/lib/fraud-service.ts'),readiness=read('src/lib/fraud-readiness.ts');expect(service).toContain('fraudCutoverCoverage');expect(readiness).toContain("backfill?.phase==='rolling'");expect(readiness).toContain('parityVerifiedThrough');expect(service).toContain('conversions=cutoverReady?');expect(service).toContain('stopCompliance=cutoverReady?');expect(service).toContain('writeEnabled:false');expect(service).toContain('writesPerformed:0')});
 it('selects explicit safe conversion columns and never returns raw identities to the page',()=>{const service=read('src/lib/fraud-service.ts'),page=read('src/app/fraud/page.tsx');expect(service).toContain("select='id,type,converted_at,click_at,affiliate_id");expect(service).not.toContain("select('*')");for(const marker of ['leadId','transaction_id','conversion_id','raw.ip','device_id'])expect(page).not.toContain(marker)});
 it('protects stop writes with the same unscoped-super-admin boundary, permission, CSRF, bounded JSON and an atomic audited RPC',()=>{const route=read('src/app/api/fraud/stops/route.ts'),migration=read('supabase/migrations/20260731004258_harden_fraud_stop_atomicity.sql');for(const marker of ["requirePermission('api.manage')",'assertFraudAccess','checkCsrf','parseBoundedJson','manage_fraud_stop',"'Cache-Control':'private, no-store'"])expect(route).toContain(marker);expect(route).not.toContain('mayManage');for(const marker of ['fraud_stop.create','fraud_stop.deactivate','insert into public.sync_state','revoke all on function'])expect(migration).toContain(marker);expect(route).not.toMatch(/everflow-source-blocks|activateEverflow|deactivateEverflow|EVERFLOW_API_KEY/)});
 it('makes unknown and identity-less API paths unavailable while permitting verified API identities',()=>{const control=read('src/lib/fraud-control.ts');expect(control).toContain("identityBlocked=unknownPath||(aggregateOnly&&!registrations.length)");expect(control).toContain("cohortMode=unknownPath?'unavailable':registrations.length&&cohortReliable?'user_joined':aggregateOnly?'aggregate_only':'unavailable'");expect(control).toContain("identityBlocked||!identityReliable('rebill',rebillCoverage)?{status:'unknown'")});
 it('offers an exact per-row stop action and carries the source dimensions into it',()=>{const page=read('src/app/fraud/page.tsx'),button=read('src/app/fraud/FraudStopRowButton.tsx');expect(page).toContain('<FraudStopRowButton');for(const marker of ['sourceDimension','subSourceDimension','affiliateId','offerId'])expect(button).toContain(marker);expect(button).toContain('Jetzt als gestoppt markieren')});
 it('renders every stop mutation control only for api.manage users',()=>{const page=read('src/app/fraud/page.tsx');expect(page).toContain("canManageStops?<FraudStopForm/>");expect(page).toContain("canManageStops?<FraudStopDeactivateButton")});
 it('lets historical tracked stops select the exact sub1 through sub5 dimension',()=>{const form=read('src/app/fraud/FraudStopForm.tsx');for(const dimension of ['sub1','sub2','sub3','sub4','sub5'])expect(form).toContain(`value=\"${dimension}\"`)});
 it('does not expose internal database errors from the stop endpoint',()=>{const route=read('src/app/api/fraud/stops/route.ts');expect(route).not.toContain('result.error.message');expect(route).toContain("{error:'Stop konnte nicht gespeichert werden'}")});
});
