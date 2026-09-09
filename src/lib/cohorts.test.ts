import {beforeEach,describe,expect,it,vi} from 'vitest';
import {parseAccessMetadata,type AccessMetadata} from './rbac';

vi.mock('server-only',()=>({}));
const rpc=vi.fn();
const upsert=vi.fn();
const from=vi.fn(()=>({upsert}));
vi.mock('./supabase',()=>({getSupabaseAdmin:()=>({rpc,from})}));

const access=(role:'super_admin'|'admin'|'employee'|'partner'|'read_only',scopes:Record<string,string[]>={})=>parseAccessMetadata({role,status:'active',version:1,scopes});
const row={registration_month:'2026-07-01',affiliate_id:'a1',offer_id:'o1',campaign_id:'c1',source_id:'s1',sub_source:'ss1',registrations:'2',revenue_30d:'3.5',revenue_60d:'4',revenue_90d:'5',revenue_180d:'6',revenue_365d:'7'};

describe('materialized LTV cohort access',()=>{
 beforeEach(()=>{rpc.mockReset();from.mockClear();upsert.mockReset();rpc.mockResolvedValue({data:[row],error:null});upsert.mockResolvedValue({error:null})});
 it.each(['super_admin','admin','employee','read_only'] as const)('uses the internal snapshot RPC for the known internal role %s',async role=>{
  const {getLtvCohorts}=await import('./cohorts');
  const result=await getLtvCohorts({source:'s1',subSource:'ss1'},access(role));
  expect(rpc).toHaveBeenCalledWith('ltv_cohorts_internal_v1',{p_source:'s1',p_sub_source:'ss1'});
  expect(result).toEqual([{...row,registrations:2,revenue_30d:3.5,revenue_60d:4,revenue_90d:5,revenue_180d:6,revenue_365d:7}]);
 });
 it('rejects an unknown role before selecting the internal RPC',async()=>{
  const {getLtvCohorts}=await import('./cohorts');
  const malformed={...access('employee'),role:'operator'} as unknown as AccessMetadata;
  await expect(getLtvCohorts({},malformed)).rejects.toThrow('403');
  expect(rpc).not.toHaveBeenCalled();
 });
 it.each(['','  '])('treats blank source inputs %j as all sources when the partner form is submitted',async blank=>{
  const{getLtvCohorts}=await import('./cohorts');
  rpc.mockImplementation(async(_name,args)=>({data:args.p_source===null&&args.p_sub_source===null?[row,{...row,source_id:'',sub_source:'',registrations:'3'}]:[],error:null}));
  const result=await getLtvCohorts({source:blank,subSource:blank},access('admin'));
  expect(rpc).toHaveBeenCalledWith('ltv_cohorts_internal_v1',{p_source:null,p_sub_source:null});
  expect(result.map(row=>row.registrations)).toEqual([2,3]);
 });
 it('retains mandatory source scopes when blank optional filters mean all allowed sources',async()=>{
  const{getLtvCohorts}=await import('./cohorts');
  await getLtvCohorts({source:'',subSource:' '},access('employee',{affiliate:['6'],source:['own']}));
  expect(rpc).toHaveBeenCalledWith('ltv_cohorts_scoped_v1',expect.objectContaining({p_affiliate_ids:['6'],p_source_ids:['own'],p_source:null,p_sub_source:null}));
 });
 it('preserves nonblank source identifiers exactly, including zero and meaningful spaces',async()=>{
  const{getLtvCohorts}=await import('./cohorts');
  await getLtvCohorts({source:'0',subSource:' with spaces '},access('admin'));
  expect(rpc).toHaveBeenCalledWith('ltv_cohorts_internal_v1',{p_source:'0',p_sub_source:' with spaces '});
 });
 it('uses the scoped snapshot RPC with every mandatory scope and request filter',async()=>{
  const {getLtvCohorts}=await import('./cohorts');
  await getLtvCohorts({source:'s1',subSource:'ss1'},access('partner',{affiliate:['a1'],offer:['o1'],campaign:['c1'],source:['s1'],sub_source:['ss1']}));
  expect(rpc).toHaveBeenCalledWith('ltv_cohorts_scoped_v1',{p_affiliate_ids:['a1'],p_offer_ids:['o1'],p_campaign_ids:['c1'],p_source_ids:['s1'],p_sub_sources:['ss1'],p_source:'s1',p_sub_source:'ss1'});
 });
 it('passes empty partner scopes to the fail-closed scoped RPC rather than the unrestricted RPC',async()=>{
  const {getLtvCohorts}=await import('./cohorts');
  await getLtvCohorts({},access('partner'));
  expect(rpc).toHaveBeenCalledWith('ltv_cohorts_scoped_v1',expect.objectContaining({p_affiliate_ids:[],p_offer_ids:[],p_campaign_ids:[],p_source_ids:[],p_sub_sources:[]}));
  expect(rpc).not.toHaveBeenCalledWith('ltv_cohorts_internal_v1',expect.anything());
 });
 it('preserves foreign known-ID denial and unsupported account fail-closed behavior',async()=>{
  const {getLtvCohorts}=await import('./cohorts');
  await expect(getLtvCohorts({source:'foreign'},access('partner',{source:['own']}))).rejects.toThrow('403');
  await expect(getLtvCohorts({},access('partner',{account:['acct']}))).rejects.toThrow('403');
  expect(rpc).not.toHaveBeenCalled();
 });
 it.each(['super_admin','admin','employee','read_only'] as const)('enforces assigned cohort scopes for internal role %s',async role=>{
  const {getLtvCohorts}=await import('./cohorts');
  await getLtvCohorts({},access(role,{affiliate:['a1'],offer:['o1'],campaign:['c1'],source:['s1'],sub_source:['ss1']}));
  expect(rpc).toHaveBeenCalledWith('ltv_cohorts_scoped_v1',{p_affiliate_ids:['a1'],p_offer_ids:['o1'],p_campaign_ids:['c1'],p_source_ids:['s1'],p_sub_sources:['ss1'],p_source:null,p_sub_source:null});
  expect(rpc).not.toHaveBeenCalledWith('ltv_cohorts_internal_v1',expect.anything());
 });
 it('rejects unsupported and foreign internal scopes before a database read',async()=>{
  const {getLtvCohorts}=await import('./cohorts');
  await expect(getLtvCohorts({},access('super_admin',{account:['acct']}))).rejects.toThrow('403');
  await expect(getLtvCohorts({source:'foreign'},access('admin',{source:['own']}))).rejects.toThrow('403');
  await expect(getLtvCohorts({subSource:'foreign'},access('employee',{sub_source:['own']}))).rejects.toThrow('403');
  expect(rpc).not.toHaveBeenCalled();
 });
 it('allows a filter on an unrestricted dimension while retaining the internal affiliate restriction',async()=>{
  const {getLtvCohorts}=await import('./cohorts');
  await getLtvCohorts({source:'s1'},access('employee',{affiliate:['a1']}));
  expect(rpc).toHaveBeenCalledWith('ltv_cohorts_scoped_v1',expect.objectContaining({p_affiliate_ids:['a1'],p_source:'s1'}));
 });
});

describe('refreshLtvCohorts',()=>{
 beforeEach(()=>{rpc.mockReset();from.mockClear();upsert.mockReset();upsert.mockResolvedValue({error:null})});
 it('runs the fixed refresh RPC and records ready state',async()=>{
  rpc.mockResolvedValue({data:{status:'refreshed'},error:null});
  const {refreshLtvCohorts}=await import('./cohorts');
  await expect(refreshLtvCohorts()).resolves.toEqual({status:'refreshed'});
  expect(rpc).toHaveBeenCalledWith('refresh_ltv_cohorts_v1');
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({key:'ltv_cohorts_materialized',value:expect.objectContaining({status:'ready'})}),{onConflict:'key'});
 });
 it('records bounded failed state and rethrows a refresh error',async()=>{
  rpc.mockResolvedValue({data:null,error:{message:'x'.repeat(900)}});
  const {refreshLtvCohorts}=await import('./cohorts');
  await expect(refreshLtvCohorts()).rejects.toThrow('Supabase LTV refresh');
  const value=upsert.mock.calls[0][0].value as {status:string;error:string};
  expect(value.status).toBe('failed');
  expect(value.error.length).toBeLessThanOrEqual(500);
 });
 it('treats an advisory-lock busy response as failed instead of recording stale data ready',async()=>{
  rpc.mockResolvedValue({data:{status:'busy'},error:null});
  const {refreshLtvCohorts}=await import('./cohorts');
  await expect(refreshLtvCohorts()).rejects.toThrow('läuft bereits');
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({value:expect.objectContaining({status:'failed'})}),{onConflict:'key'});
 });
 it.each([{status:'failed',error:'refresh_timeout'},null,{}, {status:'unexpected'}])('never turns a non-successful SQL response into ready: %j',async data=>{
  rpc.mockResolvedValue({data,error:null});
  const {refreshLtvCohorts}=await import('./cohorts');
  await expect(refreshLtvCohorts()).rejects.toThrow('Supabase LTV refresh');
  expect(upsert).not.toHaveBeenCalledWith(expect.objectContaining({value:expect.objectContaining({status:'ready'})}),expect.anything());
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({value:expect.objectContaining({status:'failed'})}),{onConflict:'key'});
 });
 it('records the actual database refresh time instead of the request start',async()=>{
  rpc.mockResolvedValue({data:{status:'refreshed',refreshed_at:'2026-09-06T21:41:00Z'},error:null});
  const {refreshLtvCohorts}=await import('./cohorts');
  await refreshLtvCohorts();
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({value:expect.objectContaining({refreshed_at:'2026-09-06T21:41:00Z'})}),{onConflict:'key'});
 });
});
