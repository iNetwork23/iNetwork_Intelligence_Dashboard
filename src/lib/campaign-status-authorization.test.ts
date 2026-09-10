import {beforeEach,expect,it,vi} from 'vitest';
import {MemorySecurityStore} from './security';
import {can,parseAccessMetadata} from './rbac';
import type {CurrentUser} from './session';
const fixture=vi.hoisted(()=>({user:null as CurrentUser|null,afterRead:null as (()=>void)|null,writes:0,audits:[]as unknown[],store:null as unknown}));
vi.mock('next/cache',()=>({revalidateTag:vi.fn()}));
vi.mock('./session',()=>({resolveCurrentUserUncached:async()=>fixture.user,requirePermission:async()=>({ok:true,user:fixture.user,status:200})}));
vi.mock('./access-store',()=>({securityStore:()=>fixture.store,audit:async(value:unknown)=>{fixture.audits.push(value)},requestEvidence:()=>({})}));
vi.mock('./smartlink-service',()=>({getCampaignAffiliateMappings:async()=>[{campaignId:135,affiliateId:'10'}]}));
vi.mock('./campaign-snapshots',()=>({patchCampaignSnapshotStatus:vi.fn()}));
vi.mock('./everflow-campaign-status',()=>({
 readEverflowCampaignStatus:async()=>{fixture.afterRead?.();return{campaignId:135,status:'active'}},
 setEverflowCampaignStatus:async(id:number,status:string,_key:string,_fetch:unknown,authorize?:()=>Promise<unknown>)=>{await authorize?.();fixture.writes++;return{campaignId:id,status}},
}));
import {POST} from '../app/api/campaign-status/route';
const admin:CurrentUser={id:'admin',actorId:'admin',email:'qa@example.invalid',impersonating:false,access:parseAccessMetadata({role:'super_admin'})};
const request=()=>new Request('http://localhost:3000/api/campaign-status',{method:'POST',headers:{origin:'http://localhost:3000','sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify({campaignId:135,affiliateId:'10',status:'paused'})});
beforeEach(()=>{fixture.user=admin;fixture.afterRead=null;fixture.writes=0;fixture.audits=[];fixture.store=new MemorySecurityStore();delete process.env.APP_ORIGIN});
it('preserves the authorized write, audit and readback path',async()=>{expect((await POST(request())).status).toBe(200);expect(fixture.writes).toBe(1);expect(fixture.audits).toHaveLength(1)});
it.each(['affiliate','offer','account','source','sub_source'] as const)('refuses a campaign-wide status change through a narrower %s permission',async dimension=>{
 fixture.user={...admin,access:parseAccessMetadata({role:'employee',grants:['campaigns.edit','api.manage'],scopes:{[dimension]:['10'],campaign:['135']}})};
 expect((await POST(request())).status).toBe(403);expect(fixture.writes).toBe(0);expect(fixture.audits).toHaveLength(0);
});
it('refuses a foreign campaign even when all non-campaign dimensions are unrestricted',async()=>{
 fixture.user={...admin,access:parseAccessMetadata({role:'employee',grants:['campaigns.edit','api.manage'],scopes:{campaign:['999']}})};
 expect((await POST(request())).status).toBe(403);expect(fixture.writes).toBe(0);
});
it.each(['revoked','permission','scope','version','identity','actor','impersonation'] as const)('prevents a campaign write when %s changes during provider reads',async(change)=>{
 fixture.afterRead=()=>{fixture.user=change==='revoked'?null:change==='permission'?{...admin,access:parseAccessMetadata({role:'analyst'})}:change==='scope'?{...admin,access:parseAccessMetadata({role:'super_admin',scopes:{affiliate:['20']}})}:change==='version'?{...admin,access:{...admin.access,version:admin.access.version+1}}:change==='identity'?{...admin,id:'other'}:change==='actor'?{...admin,actorId:'other'}:{...admin,impersonating:true}};
 expect((await POST(request())).status).toBe(403);expect(fixture.writes).toBe(0);expect(fixture.audits).toHaveLength(0);
 if(change==='scope')expect(can(fixture.user!.access,'api.manage')).toBe(true);
});
