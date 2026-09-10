import {afterEach,expect,it,vi} from 'vitest';
import {MemorySecurityStore} from './security';
import {normalizeAutomationDraft} from './automation-config';
import {createAutomationConfiguration,getAutomationConfiguration,transitionAutomation} from './automation-store';
import {executeAutomationRun} from './automation-runner';
import {automationRuntimeDependencies} from './automation-runtime';
import {campaignAutomationFingerprint,type AutomationCampaign} from './everflow-automation';
vi.mock('server-only',()=>({}));
vi.mock('./cached-smartlinks',()=>({loadAffiliateSmartlinkInsightsFromCache:vi.fn()}));
vi.mock('./cached-evaluations',()=>({loadAffiliateConversionsFromCache:vi.fn()}));
vi.mock('./automation-preflight',()=>({runAutomationPreflight:vi.fn()}));
const make=()=>normalizeAutomationDraft({name:'Final authorization test',affiliateId:436,campaignId:146,testMode:'single_offer',strategy:'equal_slots',objective:'sale_first',offers:[{offerId:57,offerName:'Offer',landingpages:[{familyKey:'a',familyName:'A',offerUrlId:1,offerUrlName:'A',status:'active'},{familyKey:'b',familyName:'B',offerUrlId:2,offerUrlName:'B',status:'active'},{familyKey:'c',familyName:'C',offerUrlId:3,offerUrlName:'C',status:'active',selection:'candidate'}]}],thresholds:{targetSois:50,minClicks:500,minAgeHours:24,maxAgeHours:336,maturityHours:168,minIndependentFirstSales:3,minIndependentPayers:3}});
const metrics=[{offerUrlId:1,clicks:5000,sois:55,cvr:.011,firstSales:0,rebills:0,revenue:100,payout:165,profit:-65,independentPayers:2,top1RevenueShare:.6,ageHours:200,mature:true},{offerUrlId:2,clicks:5000,sois:55,cvr:.011,firstSales:4,rebills:1,revenue:300,payout:165,profit:135,independentPayers:4,top1RevenueShare:.4,ageHours:200,mature:true}];
const campaign=():AutomationCampaign=>({network_campaign_id:146,network_affiliate_id:436,campaign_name:'Test',campaign_status:'active',network_tracking_domain_id:6450,redirect_routing_type:'weight',is_open_to_affiliates:false,is_use_secure_link:true,relationship:{labels:[],redirects:{entries:[{redirect_network_offer_id:57,redirect_network_offer_url_id:1,routing_value:50},{redirect_network_offer_id:57,redirect_network_offer_url_id:2,routing_value:50}]}}});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()});
it.each(['before_write','after_write','never'] as const)('guards the final provider boundary and preserves rollback when revoked %s',async phase=>{
 vi.stubEnv('EVERFLOW_API_KEY','test-only');
 const before=campaign(),fingerprint=campaignAutomationFingerprint(before),store=new MemorySecurityStore(),created=await createAutomationConfiguration(store,make(),'qa'),dry=await transitionAutomation(store,created.id,1,'dry_run','qa'),awaiting=await transitionAutomation(store,created.id,dry.version,'request_live','qa'),active=await transitionAutomation(store,created.id,awaiting.version,'activate_live','qa',{preflightVerified:true,baselineFingerprint:fingerprint});
 let permitted=true,state=structuredClone(before),writes=0,reads=0;
 const methods:string[]=[];
 vi.stubGlobal('fetch',vi.fn(async(_url:unknown,init?:RequestInit)=>{
  const method=init?.method||'GET';methods.push(method);
  if(method==='PUT'){
   writes++;const payload=JSON.parse(String(init?.body));state={...state,...payload,relationship:{labels:payload.labels,redirects:{entries:payload.redirects}}};
   if(phase==='after_write'&&writes===1)permitted=false;
   return new Response(null,{status:204});
  }
  reads++;
  if(phase==='before_write'&&reads===1)permitted=false;
  if(phase==='after_write'&&reads===2)throw new Error('verification unavailable');
  return Response.json(state);
 }));
 const runtime=automationRuntimeDependencies({authorize:async()=>{if(!permitted)throw new Error('Keine Berechtigung')},beforeWrite:async()=>{}});
 const run=executeAutomationRun(store,active.id,'live','qa',{...runtime,loadMetrics:async()=>metrics,preflight:async()=>({verified:true,fingerprint,blockers:[]})});
 if(phase==='before_write'){
  await expect(run).rejects.toThrow('Keine Berechtigung');expect(methods).toEqual(['GET']);expect(writes).toBe(0);
  expect(await getAutomationConfiguration(store,active.id)).toMatchObject({status:'hold',writeEnabled:false,slots:active.slots,lastIncident:{providerMutated:false,compensation:'not_needed'},runs:[expect.objectContaining({verified:false,writesPerformed:0})]});
 }else if(phase==='after_write'){
  await expect(run).rejects.toThrow('wiederhergestellt');expect(methods).toEqual(['GET','PUT','GET','PUT','GET']);expect(campaignAutomationFingerprint(state)).toBe(fingerprint);
  expect(await getAutomationConfiguration(store,active.id)).toMatchObject({status:'hold',writeEnabled:false,slots:active.slots,lastIncident:{providerMutated:true,compensation:'verified'}});
 }else{
  expect(await run).toMatchObject({writesPerformed:1,configuration:{status:'active',slots:[{offerUrlId:3},{offerUrlId:2}]}});expect(methods).toEqual(['GET','PUT','GET']);
 }
});
