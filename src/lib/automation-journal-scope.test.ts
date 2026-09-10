import {beforeEach,expect,it,vi} from 'vitest';
import {can,parseAccessMetadata,type AccessMetadata} from './rbac';
import journal from '../data/automation-journal';
const fixture=vi.hoisted(()=>({access:null as AccessMetadata|null}));
vi.mock('next/cache',()=>({revalidateTag:vi.fn(),unstable_cache:(load:()=>unknown)=>load}));
vi.mock('./session',()=>({requirePermission:async(permission:Parameters<typeof can>[1])=>fixture.access&&can(fixture.access,permission)?{ok:true,user:{id:'qa',actorId:'qa',access:fixture.access}}:{ok:false,status:fixture.access?403:401},resolveCurrentUserUncached:async()=>null}));
vi.mock('./access-store',()=>({securityStore:()=>({}),audit:vi.fn(),requestEvidence:()=>({})}));
vi.mock('./automation-store',()=>({listAutomationConfigurations:async()=>[],getAutomationConfiguration:async()=>({id:'test',affiliateId:6,campaignId:2,offers:[]})}));
import {GET,POST} from '../app/api/automation/route';
import {automationJournalForAccess} from './automation-journal-scope';
beforeEach(()=>{fixture.access=parseAccessMetadata({role:'super_admin'})});
it('keeps the complete journal for an unrestricted reader',async()=>{expect(await(await GET()).json()).toMatchObject(journal)});
it('does not return foreign legacy campaigns, rotations or evaluations to an Affiliate-6 reader',async()=>{
 fixture.access=parseAccessMetadata({role:'employee',grants:['campaigns.edit','finance.view','automations.manage'],scopes:{affiliate:['6']}});
 const body=await(await GET()).json();expect(body.campaigns.map((row:{campaignId:number})=>row.campaignId)).toEqual([2]);
 expect(body.rotations.every((row:{campaignId:number})=>row.campaignId===2)).toBe(true);expect(body.evaluations.every((row:{campaignId:number})=>row.campaignId===2)).toBe(true);
 expect(JSON.stringify(body)).not.toContain('Traffic Company');expect(JSON.stringify(body)).not.toContain('Affiliate 436');
});
it.each(['live_run','activate_live','resume'])('rejects %s from a narrow Affiliate-6 scope before entering the provider workflow',async action=>{
 fixture.access=parseAccessMetadata({role:'employee',grants:['campaigns.edit','api.manage','finance.view','automations.manage','automations.live'],scopes:{affiliate:['6']}});
 expect((await(await GET()).json()).canRunLive).toBe(false);
 const request=new Request('http://localhost:3000/api/automation',{method:'POST',headers:{origin:'http://localhost:3000','sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify({action,id:'test'})});
 expect((await POST(request)).status).toBe(403);
});
it('does not attach ambiguous shared-campaign or unknown history to a scoped journal',()=>{
 const shared={campaigns:[{campaignId:2,affiliateId:6},{campaignId:2,affiliateId:99}],rotations:[{campaignId:2},{campaignId:100}],evaluations:[{campaignId:2},{campaignId:100}]};
 const access=parseAccessMetadata({role:'employee',scopes:{affiliate:['6']}}),result=automationJournalForAccess(shared,access);
 expect(result.campaigns).toEqual([{campaignId:2,affiliateId:6}]);expect(result.rotations).toEqual([]);expect(result.evaluations).toEqual([]);
});
it.each([{offer:['57']},{source:['s']},{sub_source:['s']},{account:['a']},{affiliate:['6'],campaign:['146']}])('does not expose unprovable legacy scope %j',async scopes=>{
 fixture.access=parseAccessMetadata({role:'employee',grants:['campaigns.edit','finance.view','automations.manage'],scopes});
 const body=await(await GET()).json();expect(body.campaigns).toEqual([]);expect(body.rotations).toEqual([]);expect(body.evaluations).toEqual([]);
});
