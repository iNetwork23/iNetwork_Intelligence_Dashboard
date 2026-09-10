import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MemorySecurityStore} from './security';
import {parseAccessMetadata} from './rbac';
import {buildEverflowBlockPayload} from './everflow-source-blocks';
import {normalizeSourceBlockInput,sourceBlockStoreKey,type SourceBlockInput,type SourceBlockRecord} from './source-blocks';
vi.mock('server-only',()=>({}));
vi.mock('next/cache',()=>({revalidateTag:vi.fn(),unstable_cache:(fn:unknown)=>fn}));
const mocks=vi.hoisted(()=>({store:undefined as unknown,permitted:true,scopeRows:vi.fn(),audit:vi.fn()}));
const user=()=>({id:'qa',actorId:'qa',access:parseAccessMetadata({role:'admin',status:'active',version:1}),impersonating:false});
vi.mock('./session',()=>({requirePermission:async()=>({ok:true,user:user()}),resolveCurrentUserUncached:async()=>mocks.permitted?user():null}));
vi.mock('./access-store',()=>({securityStore:()=>mocks.store,audit:mocks.audit,requestEvidence:()=>({})}));
vi.mock('./affiliate-optimizer-service',()=>({getAffiliateSourceScopeRows:mocks.scopeRows}));
vi.mock('./block-effects',()=>({loadBlockEffects:vi.fn(),loadBlockIndex:vi.fn(),BLOCK_EFFECTS_CACHE_TAG:'source-blocks'}));
const input:SourceBlockInput={affiliateId:'6',affiliateName:'QA',offerId:'56',offerName:'QA offer',campaignId:'2',trafficMode:'tracked',level:'main_source',mainValue:'qa-source',reasonCategory:'sonstiges'};
const block=normalizeSourceBlockInput(input),key=sourceBlockStoreKey(block);
const active:SourceBlockRecord={...block,id:'qa-block',status:'active',everflowSettingId:777,effectiveAt:'2026-09-01T00:00:00Z',createdAt:'2026-09-01T00:00:00Z',updatedAt:'2026-09-01T00:00:00Z',createdBy:'qa',updatedBy:'qa',lastVerifiedAt:'2026-09-01T00:00:00Z',error:null};
beforeEach(()=>{
 vi.clearAllMocks();mocks.store=new MemorySecurityStore();mocks.permitted=true;mocks.audit.mockResolvedValue(undefined);
 mocks.scopeRows.mockResolvedValue([{columns:[{column_type:'affiliate',id:'6'},{column_type:'offer',id:'56'},{column_type:'campaign',id:'2'},{column_type:'traffic_mode',id:'tracked'},{column_type:'source_id',id:'qa-source'}]}]);
 vi.stubEnv('APP_ORIGIN','https://example.test');vi.stubEnv('EVERFLOW_API_KEY','test-only');vi.spyOn(console,'error').mockImplementation(()=>{});
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks()});

it.each(['activate','deactivate'] as const)('rejects %s after revocation in the last provider read, with no provider mutation or residual pending record',async action=>{
 const store=mocks.store as MemorySecurityStore;if(action==='deactivate')await store.set(key,active);
 const methods:string[]=[];
 vi.stubGlobal('fetch',vi.fn(async(url:unknown,init?:RequestInit)=>{
  const path=String(url),method=init?.method||'GET';methods.push(`${method} ${path.split('?')[0].split('/').at(-1)}`);
  if(path.includes('payoutrevenuetable')){mocks.permitted=false;return Response.json({custom_payout_revenue_settings:[],paging:{total_count:0}})}
  if(method==='POST')return Response.json({network_custom_payout_revenue_setting_id:777});
  if(method==='DELETE')return Response.json({});
  mocks.permitted=false;return Response.json({...buildEverflowBlockPayload(block,'qa-block'),network_custom_payout_revenue_setting_id:777,relationship:{variables:{entries:block.variables}}});
 }));
 const {POST}=await import('@/app/api/source-blocks/route');
 const result=await POST(new Request('https://example.test/api/source-blocks',{method:'POST',headers:{origin:'https://example.test','content-type':'application/json'},body:JSON.stringify({...input,action,id:active.id})}));
 expect(result.status).toBe(403);
 expect(methods).toEqual(action==='activate'?['POST payoutrevenuetable']:['GET 777']);
 expect(await store.get(key)).toEqual(action==='activate'?null:active);
 expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({action:`source_block.${action}_failed`}));
 expect(mocks.audit).not.toHaveBeenCalledWith(expect.objectContaining({action:`source_block.${action}`}));
});

function provider(initial:SourceBlockRecord|null){
 let state=initial?{...buildEverflowBlockPayload(initial,initial.id),network_custom_payout_revenue_setting_id:initial.everflowSettingId!}:null;
 const mutations:string[]=[];
 const fetcher=vi.fn(async(url:unknown,init?:RequestInit)=>{
  const path=String(url),method=init?.method||'GET';
  if(path.includes('payoutrevenuetable'))return Response.json({custom_payout_revenue_settings:state?[state]:[],paging:{total_count:state?1:0}});
  if(method==='POST'){mutations.push('POST');state={...JSON.parse(String(init?.body)),network_custom_payout_revenue_setting_id:778};return Response.json({network_custom_payout_revenue_setting_id:778})}
  if(method==='DELETE'){mutations.push('DELETE');state=null;return Response.json({})}
  return state?Response.json({...state,relationship:{variables:{entries:state.variables},ruleset:state.ruleset}}):Response.json({error:'not found'},{status:404});
 });
 vi.stubGlobal('fetch',fetcher);
 return{fetcher,mutations,state:()=>state};
}
async function request(action:string){const{POST}=await import('@/app/api/source-blocks/route');return POST(new Request('https://example.test/api/source-blocks',{method:'POST',headers:{origin:'https://example.test','content-type':'application/json'},body:JSON.stringify({...input,action,id:active.id,confirmation:'qa-source'})}))}

it.each(['activate','deactivate'] as const)('allows one authorized %s and preserves the necessary audit rollback after subsequent revocation',async action=>{
 const store=mocks.store as MemorySecurityStore;if(action==='deactivate')await store.set(key,active);
 const remote=provider(action==='deactivate'?active:null);
 mocks.audit.mockImplementation(async(event:{action:string})=>{if(event.action===`source_block.${action}`){mocks.permitted=false;throw new Error('audit unavailable')}});
 const result=await request(action);
 expect(result.status).toBe(502);expect(await result.json()).toMatchObject({error:expect.stringContaining('wiederhergestellt')});
 expect(remote.mutations).toEqual(action==='activate'?['POST','DELETE']:['DELETE','POST']);
 if(action==='activate'){expect(await store.get(key)).toBeNull();expect(remote.state()).toBeNull()}
 else{expect(await store.get(key)).toEqual({...active,everflowSettingId:778});expect(remote.state()).toMatchObject({network_offer_id:56,network_affiliate_ids:[6],payout_amount:0,is_postback_disabled:true})}
});

it.each(['activate','deactivate'] as const)('performs exactly one provider mutation for an authorized %s',async action=>{
 const store=mocks.store as MemorySecurityStore;if(action==='deactivate')await store.set(key,active);
 const remote=provider(action==='deactivate'?active:null),result=await request(action);
 expect(result.status).toBe(action==='activate'?201:200);expect(remote.mutations).toEqual([action==='activate'?'POST':'DELETE']);
 expect(await store.get(key)).toMatchObject({status:action==='activate'?'active':'inactive',error:null,everflowSettingId:action==='activate'?778:null});
});

it('does not adopt an existing provider rule after revocation',async()=>{
 const remote=provider(active),original=remote.fetcher.getMockImplementation()!;
 remote.fetcher.mockImplementation(async(url,init)=>{const result=await original(url,init);if(!String(url).includes('payoutrevenuetable'))mocks.permitted=false;return result});
 expect((await request('activate')).status).toBe(403);expect(remote.mutations).toEqual([]);expect(await (mocks.store as MemorySecurityStore).get(key)).toBeNull();expect(remote.state()).not.toBeNull();
});

it('rechecks authorization after the asynchronous source-scope read',async()=>{
 const rows=await mocks.scopeRows(),remote=provider(null);let reads=0;
 mocks.scopeRows.mockImplementation(async()=>{reads++;if(reads===3)mocks.permitted=false;return rows});
 expect((await request('activate')).status).toBe(403);expect(reads).toBe(3);expect(remote.mutations).toEqual([]);expect(await (mocks.store as MemorySecurityStore).get(key)).toBeNull();
});

it('prevents the provider write if the mutation lease was lost during provider reads',async()=>{
 const store=mocks.store as MemorySecurityStore,remote=provider(null),original=remote.fetcher.getMockImplementation()!;
 remote.fetcher.mockImplementation(async(url,init)=>{for(const row of await store.list('rbac:lock:'))await store.set(row.key,{owner:'different-owner',expiresAt:Date.now()+60_000});return original(url,init)});
 const result=await request('activate');expect(result.status).toBe(502);expect(remote.mutations).toEqual([]);expect(await store.get(key)).toBeNull();
});

it('compensates an earlier offer when authorization is revoked during the next offer preflight',async()=>{
 const rows=await mocks.scopeRows();mocks.scopeRows.mockResolvedValue([...rows,{columns:rows[0].columns.map((column:{column_type:string;id:string})=>column.column_type==='offer'?{...column,id:'57'}:column)}]);
 const remote=provider(null),original=remote.fetcher.getMockImplementation()!;
 remote.fetcher.mockImplementation(async(url,init)=>{if(String(url).includes('payoutrevenuetable')&&JSON.parse(String(init?.body)).filters.network_offer_ids[0]===57)mocks.permitted=false;return original(url,init)});
 const result=await request('activate_across_offers');expect(result.status).toBe(403);expect(remote.mutations).toEqual(['POST','DELETE']);expect(remote.state()).toBeNull();expect(await (mocks.store as MemorySecurityStore).list('source-block:v1:')).toEqual([]);
});

it.each(['activate','deactivate'] as const)('preserves a successor record when the %s lease is taken over before the provider write',async action=>{
 const store=mocks.store as MemorySecurityStore,successor={...active,id:'successor',revision:'successor-revision',owner:'successor-owner'};
 if(action==='deactivate')await store.set(key,active);
 const remote=provider(action==='deactivate'?active:null),original=remote.fetcher.getMockImplementation()!;
 remote.fetcher.mockImplementation(async(url,init)=>{
  await store.set(key,successor);
  for(const row of await store.list('rbac:lock:'))await store.set(row.key,{owner:'different-owner',expiresAt:Date.now()+60_000});
  return original(url,init);
 });
 const result=await request(action);expect(result.status).toBe(503);expect(remote.mutations).toEqual([]);expect(await store.get(key)).toEqual(successor);
});
