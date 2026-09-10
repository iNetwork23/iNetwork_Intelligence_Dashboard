import {beforeEach,expect,it,vi} from 'vitest';
import {MemorySecurityStore} from './security';
import {parseAccessMetadata} from './rbac';
import {normalizeAutomationDraft} from './automation-config';
import {createAutomationConfiguration,getAutomationConfiguration,transitionAutomation} from './automation-store';
const fixture=vi.hoisted(()=>({permitted:true,store:null as MemorySecurityStore|null,preflight:vi.fn(),audit:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('next/cache',()=>({revalidateTag:vi.fn(),unstable_cache:(load:()=>unknown)=>load}));
vi.mock('./session',()=>{
 const user=()=>({id:'qa',actorId:'qa',access:parseAccessMetadata({role:'super_admin'})});
 return{requirePermission:async()=>({ok:true,user:user()}),resolveCurrentUserUncached:async()=>fixture.permitted?user():null};
});
vi.mock('./access-store',()=>({securityStore:()=>fixture.store!,audit:fixture.audit,requestEvidence:()=>({})}));
vi.mock('./automation-preflight',()=>({runAutomationPreflight:fixture.preflight,assertAutomationCampaignAffiliateMapping:vi.fn()}));
import {POST} from '../app/api/automation/route';
const make=()=>normalizeAutomationDraft({name:'Revocation test',affiliateId:436,campaignId:146,testMode:'single_offer',strategy:'equal_slots',objective:'sale_first',offers:[{offerId:57,offerName:'Offer',landingpages:[{familyKey:'a',familyName:'A',offerUrlId:1,offerUrlName:'A',status:'active'},{familyKey:'b',familyName:'B',offerUrlId:2,offerUrlName:'B',status:'active'}]}],schedule:{intervalMinutes:120},thresholds:{targetSois:50,minClicks:500,minAgeHours:24,maxAgeHours:336,maturityHours:168,minIndependentFirstSales:3,minIndependentPayers:3},weights:{mode:'equal'}});
beforeEach(()=>{fixture.store=new MemorySecurityStore();fixture.permitted=true;fixture.audit.mockReset();fixture.preflight.mockReset().mockResolvedValue({verified:true,fingerprint:'sha256:before',blockers:[]})});
it.each(['activate_live','resume'])('rechecks authorization after provider preflight before %s',async action=>{
 const store=fixture.store!,created=await createAutomationConfiguration(store,make(),'qa'),dry=await transitionAutomation(store,created.id,1,'dry_run','qa'),awaiting=await transitionAutomation(store,created.id,dry.version,'request_live','qa');
 let current=awaiting;
 if(action==='resume'){const active=await transitionAutomation(store,created.id,awaiting.version,'activate_live','qa',{preflightVerified:true,baselineFingerprint:'sha256:before'});current=await transitionAutomation(store,created.id,active.version,'pause','qa')}
 fixture.preflight.mockImplementation(async()=>{fixture.permitted=false;return{verified:true,fingerprint:'sha256:after',blockers:[]}});
 const response=await POST(new Request('http://localhost:3000/api/automation',{method:'POST',headers:{origin:'http://localhost:3000','sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify({action,id:current.id,version:current.version})}));
 expect(response.status).toBe(403);expect(await getAutomationConfiguration(store,current.id)).toEqual(current);expect(fixture.audit).not.toHaveBeenCalled();
});
it.each(['activate_live','resume'])('allows %s after the final authorization still succeeds',async action=>{
 const store=fixture.store!,created=await createAutomationConfiguration(store,make(),'qa'),dry=await transitionAutomation(store,created.id,1,'dry_run','qa'),awaiting=await transitionAutomation(store,created.id,dry.version,'request_live','qa');
 let current=awaiting;
 if(action==='resume'){const active=await transitionAutomation(store,created.id,awaiting.version,'activate_live','qa',{preflightVerified:true,baselineFingerprint:'sha256:before'});current=await transitionAutomation(store,created.id,active.version,'pause','qa')}
 const response=await POST(new Request('http://localhost:3000/api/automation',{method:'POST',headers:{origin:'http://localhost:3000','sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify({action,id:current.id,version:current.version})}));
 expect(response.status).toBe(200);expect(await getAutomationConfiguration(store,current.id)).toMatchObject({status:'active',writeEnabled:true,version:current.version+1});expect(fixture.audit).toHaveBeenCalledTimes(1);
});
