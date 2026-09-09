import{beforeEach,describe,expect,it,vi}from'vitest';
import{parseAccessMetadata}from'./rbac';
import type{SourceBlockRecord}from'./source-blocks';
vi.mock('server-only',()=>({}));
vi.mock('next/cache',()=>({revalidateTag:vi.fn(),unstable_cache:(f:unknown)=>f}));
const mocks=vi.hoisted(()=>({auth:vi.fn(),blocks:vi.fn(),effects:vi.fn(),history:vi.fn(),activate:vi.fn(),scopeRows:vi.fn()}));
vi.mock('./session',()=>({requirePermission:mocks.auth,resolveCurrentUserUncached:vi.fn()}));
vi.mock('./access-store',()=>({securityStore:()=>({}),audit:vi.fn().mockResolvedValue(undefined),requestEvidence:()=>({})}));
vi.mock('./source-block-service',()=>({listSourceBlocks:mocks.blocks,activateSourceBlock:mocks.activate,activateSourceBlocksAtomically:vi.fn(),deactivateSourceBlock:mocks.activate,SourceBlockStateUncertainError:class extends Error{}}));
vi.mock('./block-effects',()=>({loadBlockEffects:mocks.effects,loadBlockIndex:vi.fn(),BLOCK_EFFECTS_CACHE_TAG:'source-blocks'}));
vi.mock('./source-block-history',async importOriginal=>({...await importOriginal<object>(),listSourceBlockHistory:mocks.history,recordSourceBlockHistory:vi.fn().mockResolvedValue(undefined)}));
vi.mock('./affiliate-optimizer-service',()=>({getAffiliateSourceScopeRows:mocks.scopeRows}));
const access=(scopes:Record<string,string[]>={affiliate:['6']})=>parseAccessMetadata({role:'admin',status:'active',scopes});
const own={id:'own',affiliateId:6,offerId:56,originCampaignId:2,trafficMode:'tracked',level:'sub_source',mainValue:'a',subValue:'b',status:'active'} as SourceBlockRecord;
const foreign={...own,id:'foreign',affiliateId:29};
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue({ok:true,user:{id:'qa',actorId:'qa',access:access()}});mocks.blocks.mockResolvedValue([own,foreign]);mocks.effects.mockResolvedValue([{record:own,soisSince:1},{record:foreign,soisSince:200}]);mocks.history.mockResolvedValue([{after:foreign}])});
describe('scoped source block reads',()=>{
 it('returns only assigned records in list and effects responses',async()=>{const{GET}=await import('@/app/api/source-blocks/route');for(const suffix of['','?effects=1&from=2026-09-01&to=2026-09-09']){const response=await GET(new Request(`https://example.test/api/source-blocks${suffix}`)),body=await response.json();expect(response.status).toBe(200);expect(body.blocks.map((b:SourceBlockRecord)=>b.id)).toEqual(['own']);if(body.effects)expect(body.effects.map((e:{record:SourceBlockRecord})=>e.record.id)).toEqual(['own'])}});
 it('does not fetch history for a foreign or missing ID',async()=>{const{GET}=await import('@/app/api/source-blocks/route');for(const id of['foreign','missing']){const response=await GET(new Request(`https://example.test/api/source-blocks?action=history&id=${id}`));expect(response.status).toBe(404);expect(await response.text()).not.toContain('29')}expect(mocks.history).not.toHaveBeenCalled()});
 it('retains access to history inside the assigned scope',async()=>{mocks.history.mockResolvedValue([{after:own}]);const{GET}=await import('@/app/api/source-blocks/route');const response=await GET(new Request('https://example.test/api/source-blocks?action=history&id=own'));expect(response.status).toBe(200);expect(mocks.history).toHaveBeenCalledWith('own',expect.anything())});
 it('requires the complete affected scope, not a campaign hint or a matching descendant',async()=>{const{sourceBlockInScope}=await import('./source-block-scope');expect(sourceBlockInScope(own,access())).toBe(true);expect(sourceBlockInScope(foreign,access())).toBe(false);expect(sourceBlockInScope(own,access({affiliate:['6'],offer:['99']}))).toBe(false);expect(sourceBlockInScope(own,access({affiliate:['6'],source:['a'],sub_source:['b']}))).toBe(true);expect(sourceBlockInScope({...own,level:'main_source',subValue:null},access({affiliate:['6'],sub_source:['b']}))).toBe(false);expect(sourceBlockInScope(own,access({campaign:['2']}))).toBe(false);expect(sourceBlockInScope(own,access({account:['1']}))).toBe(false)});
});

it.each<Record<string,string[]>>([{campaign:['2']},{affiliate:['6'],sub_source:['b']},{affiliate:['29']}])('refuses a wider activation before data access or provider service invocation: %j',async scopes=>{
 vi.stubEnv('APP_ORIGIN','https://example.test');
 mocks.auth.mockResolvedValue({ok:true,user:{id:'qa',actorId:'qa',access:access(scopes)}});
 const{POST}=await import('@/app/api/source-blocks/route');
 const response=await POST(new Request('https://example.test/api/source-blocks',{method:'POST',headers:{origin:'https://example.test','content-type':'application/json'},body:JSON.stringify({action:'activate',affiliateId:'6',offerId:'56',campaignId:'2',trafficMode:'tracked',level:'main_source',mainValue:'a',reasonCategory:'sonstiges'})}));
 expect(response.status).toBe(403);expect(mocks.scopeRows).not.toHaveBeenCalled();expect(mocks.activate).not.toHaveBeenCalled();vi.unstubAllEnvs();
});
