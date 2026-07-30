import {describe,expect,it,vi} from 'vitest';
import {applyAutomationRouting,AutomationCampaignMutationError,buildAutomationCampaignPayload,campaignAutomationFingerprint,type AutomationCampaign} from './everflow-automation';

const campaign=(url=101):AutomationCampaign=>({network_campaign_id:146,network_affiliate_id:436,campaign_name:'Test',campaign_status:'active',network_tracking_domain_id:6450,redirect_routing_type:'weight',is_open_to_affiliates:false,is_use_secure_link:true,catch_all_network_offer_id:0,data_collection_threshold:100,data_lookback_window:'24_hours',metric:'revenue',optimization_goal:1,run_frequency:'24_hours',conversion_method:'server_postback',is_whitelist_check_enabled:false,relationship:{redirects:{entries:[{network_campaign_redirect_id:1,redirect_network_offer_id:57,redirect_network_offer_url_id:url,routing_value:50,ruleset:{countries:['DE']}},{network_campaign_redirect_id:2,redirect_network_offer_id:57,redirect_network_offer_url_id:102,routing_value:50,ruleset:{countries:['AT']}}]},labels:{entries:['live']}}});
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const target=[{offerId:57,offerUrlId:103,familyKey:'c',familyName:'C',offerUrlName:'C',weight:50},{offerId:57,offerUrlId:102,familyKey:'b',familyName:'B',offerUrlName:'B',weight:50}];
const applyPayload=(current:AutomationCampaign,bodyText:string):AutomationCampaign=>{const {redirects,labels,...fields}=JSON.parse(bodyText);return{...current,...fields,relationship:{...current.relationship,redirects:{entries:redirects},labels:{entries:labels}}}};

describe('Everflow automation writer',()=>{
 it('fingerprints semantic routing but ignores technical redirect IDs',()=>{
  const a=campaign(),b=campaign();b.relationship.redirects.entries[0].network_campaign_redirect_id=999;
  expect(campaignAutomationFingerprint(a)).toBe(campaignAutomationFingerprint(b));
  b.relationship.redirects.entries[0].redirect_network_offer_url_id=999;
  expect(campaignAutomationFingerprint(a)).not.toBe(campaignAutomationFingerprint(b));
 });
 it.each([
  ['campaign_name','Changed'],['catch_all_network_offer_id',7],['data_collection_threshold',200],['data_lookback_window','48_hours'],['metric','profit'],['optimization_goal',2],['run_frequency','12_hours'],['conversion_method','pixel_tracking'],['is_whitelist_check_enabled',true],['campaign_status','paused'],['network_tracking_domain_id',999],['redirect_routing_type','priority'],['is_open_to_affiliates',true],['is_use_secure_link',false],
 ] as const)('fingerprints changes to full-PUT field %s',(field,value)=>{
  const before=campaign(),changed={...campaign(),[field]:value};
  expect(campaignAutomationFingerprint(changed)).not.toBe(campaignAutomationFingerprint(before));
 });
 it('fingerprints labels and canonical redirect rulesets',()=>{
  const before=campaign(),changedLabels=campaign(),changedRuleset=campaign();
  changedLabels.relationship.labels={entries:['other']};
  changedRuleset.relationship.redirects.entries[1].ruleset={countries:['CH']};
  expect(campaignAutomationFingerprint(changedLabels)).not.toBe(campaignAutomationFingerprint(before));
  expect(campaignAutomationFingerprint(changedRuleset)).not.toBe(campaignAutomationFingerprint(before));
 });
 it.each([
  ['redirect_network_offer_id',58],['redirect_network_offer_url_id',999],['routing_value',49],['ruleset',{countries:['CH']}],
 ] as const)('fingerprints changes to redirect field %s',(field,value)=>{
  const before=campaign(),changed=campaign();Object.assign(changed.relationship.redirects.entries[0],{[field]:value});
  expect(campaignAutomationFingerprint(changed)).not.toBe(campaignAutomationFingerprint(before));
 });
 it.each([
  ['labels',()=>{const value=campaign();delete value.relationship.labels;return value}],
  ['campaign_name',()=>({...campaign(),campaign_name:' '})],
  ['campaign_status',()=>({...campaign(),campaign_status:'invalid'})],
  ['network_tracking_domain_id',()=>({...campaign(),network_tracking_domain_id:-1})],
  ['redirect_routing_type',()=>({...campaign(),redirect_routing_type:'random'})],
  ['is_open_to_affiliates',()=>({...campaign(),is_open_to_affiliates:'false' as unknown as boolean})],
  ['is_use_secure_link',()=>({...campaign(),is_use_secure_link:1 as unknown as boolean})],
  ['catch_all_network_offer_id',()=>({...campaign(),catch_all_network_offer_id:-1})],
  ['data_collection_threshold',()=>({...campaign(),data_collection_threshold:1.5})],
  ['data_lookback_window',()=>({...campaign(),data_lookback_window:'forever'})],
  ['metric',()=>({...campaign(),metric:'sales'})],
  ['optimization_goal',()=>({...campaign(),optimization_goal:Number.NaN})],
  ['run_frequency',()=>({...campaign(),run_frequency:'weekly'})],
  ['conversion_method',()=>({...campaign(),conversion_method:'browser'})],
  ['is_whitelist_check_enabled',()=>({...campaign(),is_whitelist_check_enabled:'yes' as unknown as boolean})],
  ['redirect offer',()=>{const value=campaign();value.relationship.redirects.entries[0].redirect_network_offer_id=-1;return value}],
  ['redirect URL',()=>{const value=campaign();value.relationship.redirects.entries[0].redirect_network_offer_url_id=1.5;return value}],
  ['redirect weight',()=>{const value=campaign();value.relationship.redirects.entries[0].routing_value=Number.NaN;return value}],
  ['redirect ruleset',()=>{const value=campaign();value.relationship.redirects.entries[0].ruleset={bad:undefined};return value}],
 ] as const)('rejects malformed full-PUT field %s before building a payload',(_field,makeInvalid)=>{
  expect(()=>buildAutomationCampaignPayload(makeInvalid(),target)).toThrow('Campaign-Snapshot');
 });
 it('builds a complete payload and preserves rulesets by offer and URL identity, not position',()=>{
  const payload=buildAutomationCampaignPayload(campaign(),target);
  expect(payload).toMatchObject({campaign_name:'Test',campaign_status:'active',network_tracking_domain_id:6450,redirect_routing_type:'weight',is_open_to_affiliates:false,is_use_secure_link:true,labels:['live'],catch_all_network_offer_id:0,data_collection_threshold:100,data_lookback_window:'24_hours',metric:'revenue',optimization_goal:1,run_frequency:'24_hours',conversion_method:'server_postback',is_whitelist_check_enabled:false});
  expect(payload.redirects).toEqual([{redirect_network_offer_id:57,redirect_network_offer_url_id:103,routing_value:50},{redirect_network_offer_id:57,redirect_network_offer_url_id:102,routing_value:50,ruleset:{countries:['AT']}}]);
 });
 it('writes once and succeeds only after a matching GET verification',async()=>{
  const before=campaign(),after=campaign();after.relationship.redirects.entries=buildAutomationCampaignPayload(before,target).redirects;
  const fetcher=vi.fn().mockResolvedValueOnce(response(before)).mockResolvedValueOnce(response({ok:true})).mockResolvedValueOnce(response(after));
  const result=await applyAutomationRouting({campaignId:146,affiliateId:436,targetSlots:target,expectedFingerprint:campaignAutomationFingerprint(before),apiKey:'secret',fetcher});
  expect(result.verified).toBe(true);expect(result.writesPerformed).toBe(1);expect(fetcher).toHaveBeenCalledTimes(3);
 });
 it('blocks a foreign baseline before any PUT',async()=>{
  const fetcher=vi.fn().mockResolvedValue(response(campaign()));
  await expect(applyAutomationRouting({campaignId:146,affiliateId:436,targetSlots:target,expectedFingerprint:'sha256:foreign',apiKey:'secret',fetcher})).rejects.toThrow('Fremdänderung');
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('rolls back and verifies the original state when post-write verification differs',async()=>{
  const before=campaign(),wrong=campaign(999),fetcher=vi.fn().mockResolvedValueOnce(response(before)).mockResolvedValueOnce(response({ok:true})).mockResolvedValueOnce(response(wrong)).mockResolvedValueOnce(response({ok:true})).mockResolvedValueOnce(response(before));
  await expect(applyAutomationRouting({campaignId:146,affiliateId:436,targetSlots:target,expectedFingerprint:campaignAutomationFingerprint(before),apiKey:'secret',fetcher})).rejects.toThrow('wiederhergestellt');
  expect(fetcher).toHaveBeenCalledTimes(5);
 });
 it('detects a concurrent change to a non-routing PUT field and restores the exact original payload',async()=>{
  const before=campaign(),changed=campaign();changed.data_collection_threshold=999;
  const fetcher=vi.fn().mockResolvedValueOnce(response(before)).mockResolvedValueOnce(response({ok:true})).mockResolvedValueOnce(response(changed)).mockResolvedValueOnce(response({ok:true})).mockResolvedValueOnce(response(before));
  await expect(applyAutomationRouting({campaignId:146,affiliateId:436,targetSlots:target,expectedFingerprint:campaignAutomationFingerprint(before),apiKey:'secret',fetcher})).rejects.toMatchObject({mutationMayHaveOccurred:true,compensationVerified:true});
  const rollback=JSON.parse(String(fetcher.mock.calls[3][1]?.body));
  expect(rollback).toEqual(buildAutomationCampaignPayload(before,before.relationship.redirects.entries.map((row,index)=>({offerId:row.redirect_network_offer_id,offerUrlId:row.redirect_network_offer_url_id,familyKey:String(index),familyName:String(index),offerUrlName:String(index),weight:row.routing_value}))));
 });
 it('attempts and verifies compensation when the intended PUT times out ambiguously',async()=>{
  const before=campaign();
  let state=before,putCount=0;
  const fetcher=vi.fn(async(_url:string|URL|Request,init?:RequestInit)=>{
   if(init?.method==='PUT'){
    putCount++;state=applyPayload(state,String(init.body));
    if(putCount===1)throw new Error('timeout after send');
    return response({ok:true});
   }
   return response(state);
  });
  const error=await applyAutomationRouting({campaignId:146,affiliateId:436,targetSlots:target,expectedFingerprint:campaignAutomationFingerprint(before),apiKey:'secret',fetcher}).catch(value=>value);
  expect(error).toBeInstanceOf(AutomationCampaignMutationError);
  expect(error).toMatchObject({mutationMayHaveOccurred:true,compensationAttempted:true,compensationVerified:true});
  expect(campaignAutomationFingerprint(state)).toBe(campaignAutomationFingerprint(before));
 });
 it('attempts and verifies compensation when read-back fails after an acknowledged write',async()=>{
  const before=campaign(),fetcher=vi.fn().mockResolvedValueOnce(response(before)).mockResolvedValueOnce(new Response(null,{status:204})).mockRejectedValueOnce(new Error('read timeout')).mockResolvedValueOnce(new Response(null,{status:204})).mockResolvedValueOnce(response(before));
  const error=await applyAutomationRouting({campaignId:146,affiliateId:436,targetSlots:target,expectedFingerprint:campaignAutomationFingerprint(before),apiKey:'secret',fetcher}).catch(value=>value);
  expect(error).toBeInstanceOf(AutomationCampaignMutationError);
  expect(error).toMatchObject({mutationMayHaveOccurred:true,compensationAttempted:true,compensationVerified:true});
  expect(fetcher.mock.calls.map(call=>call[1]?.method||'GET')).toEqual(['GET','PUT','GET','PUT','GET']);
 });
 it('verifies compensation even when the rollback response also times out ambiguously',async()=>{
  const before=campaign();let state=before,putCount=0;
  const fetcher=vi.fn(async(_url:string|URL|Request,init?:RequestInit)=>{
   if(init?.method==='PUT'){
    putCount++;state=applyPayload(state,String(init.body));
    throw new Error(putCount===1?'write timeout':'rollback timeout');
   }
   return response(state);
  });
  const error=await applyAutomationRouting({campaignId:146,affiliateId:436,targetSlots:target,expectedFingerprint:campaignAutomationFingerprint(before),apiKey:'secret',fetcher}).catch(value=>value);
  expect(error).toMatchObject({mutationMayHaveOccurred:true,compensationAttempted:true,compensationVerified:true});
  expect(fetcher).toHaveBeenCalledTimes(4);
 });
 it('reports an uncertain provider state when compensation cannot be verified',async()=>{
  const before=campaign(),after=campaign();after.relationship.redirects.entries=buildAutomationCampaignPayload(before,target).redirects;
  let calls=0;
  const fetcher=vi.fn(async(_url:string|URL|Request,init?:RequestInit)=>{
   calls++;
   if(calls===1)return response(before);
   if(init?.method==='PUT')throw new Error('network timeout');
   return response(after);
  });
  const error=await applyAutomationRouting({campaignId:146,affiliateId:436,targetSlots:target,expectedFingerprint:campaignAutomationFingerprint(before),apiKey:'secret',fetcher}).catch(value=>value);
  expect(error).toBeInstanceOf(AutomationCampaignMutationError);
  expect(error).toMatchObject({mutationMayHaveOccurred:true,compensationAttempted:true,compensationVerified:false});
  expect(error.message).toContain('Zustand unklar');
 });
});
