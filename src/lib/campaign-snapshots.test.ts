import{afterEach,describe,expect,it,vi}from'vitest';
import{readFileSync}from'node:fs';
import{join}from'node:path';

const supabaseState={active:{generation:'gen-a'},rows:[] as Array<{key:string;value:unknown}>,upserts:[] as unknown[]};
function query(){const ctx={key:'',op:'select'},q:Record<string,unknown>={};for(const name of['select','like','order','range','in'])q[name]=()=>q;q.eq=(_column:string,value:string)=>{ctx.key=value;return q};q.delete=()=>{ctx.op='delete';return q};q.maybeSingle=async()=>({data:ctx.key==='campaign_snapshot_active'?{value:supabaseState.active}:null,error:null});q.upsert=async(payload:unknown)=>{supabaseState.upserts.push(payload);return{error:null}};q.then=(resolve:(value:unknown)=>void)=>resolve({data:ctx.op==='delete'?null:supabaseState.rows,error:null});return q}
vi.mock('./supabase',()=>({getSupabaseAdmin:()=>({from:()=>query()})}));

const source=()=>readFileSync(join(process.cwd(),'src/lib/campaign-snapshots.ts'),'utf8');
describe('campaign snapshot generation contract',()=>{
 it('writes immutable generation keys before switching the active pointer and schedules safe pruning only afterwards',()=>{const code=source(),write=code.indexOf("GENERATION_PREFIX}${generation}"),activate=code.indexOf("key:ACTIVE_KEY",write),prune=code.indexOf('await pruneCampaignGenerations();',activate);expect(code).toContain("const ACTIVE_KEY='campaign_snapshot_active'");expect(write).toBeGreaterThan(-1);expect(activate).toBeGreaterThan(write);expect(prune).toBeGreaterThan(activate)});
 it('validates non-empty unique directories and exact complete detail responses',()=>{const code=source();expect(code).toContain('function validDirectory');expect(code).toContain('ids.has(item.network_campaign_id)');expect(code).toContain('function validShape');expect(code).toContain('shape.network_campaign_id===expectedId');expect(code).toContain('Array.isArray(entries)');expect(code).toContain('if(!validShape(result.value,expected))throw new Error')});
 it('fetches every missing campaign instead of repeatedly truncating the unresolved set',()=>{const code=source();expect(code).not.toMatch(/candidates=.*\.slice\(0/);expect(code).toContain('start<candidates.length;start+=batchSize')});
 it('validates cached shapes and prunes only aged non-active generations with a fresh pointer read',()=>{const code=source();expect(code).toContain('if(!validShape(payload,id))throw new Error');expect(code).toContain('Date.now()-24*60*60_000');expect(code).toContain('latest=await activeGeneration()');expect(code).toContain("generation!==active")});
});
describe('syncCampaignSnapshots carry-over',()=>{
 afterEach(()=>{vi.unstubAllGlobals()});
 it('carries the fresh directory status into a non-stale cached payload without refetching details',async()=>{
  const syncedAt=new Date(Date.now()-60*60_000).toISOString(),payload={network_campaign_id:172,campaign_name:'Camp 172',campaign_status:'active',redirect_routing_type:'weighted',relationship:{redirects:{entries:[{redirect_network_offer_id:5,redirect_network_offer_url_id:0,routing_value:100}]}}};
  supabaseState.rows=[{key:'campaign_snapshot_generation:gen-a:172',value:{campaign_id:'172',campaign_name:'Camp 172',campaign_status:'active',payload,synced_at:syncedAt}}];supabaseState.upserts=[];
  const fetchMock=vi.fn(async()=>new Response(JSON.stringify({campaigns:[{network_campaign_id:172,campaign_name:'Camp 172',campaign_status:'paused'}]}),{status:200,headers:{'content-type':'application/json'}}));
  vi.stubGlobal('fetch',fetchMock);
  const{syncCampaignSnapshots}=await import('./campaign-snapshots');
  expect(await syncCampaignSnapshots('key')).toEqual({directory:1,refreshed:0,pending:0});
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const rows=supabaseState.upserts[0] as Array<{key:string;value:{campaign_status:string;payload:Record<string,unknown>;synced_at:string}}>;
  expect(rows).toHaveLength(1);expect(rows[0].key).toMatch(/^campaign_snapshot_generation:\d{13}-[0-9a-f-]{36}:172$/);
  expect(rows[0].value.campaign_status).toBe('paused');expect(rows[0].value.payload).toEqual({...payload,campaign_status:'paused'});expect(rows[0].value.synced_at).toBe(syncedAt);
 });
 it('never carries a cached status forward unchanged',()=>{const code=source();expect(code).not.toContain('payload:fresh||previous?.payload||{}');expect(code).toContain('{...previous.payload,campaign_status:item.campaign_status}')});
});
