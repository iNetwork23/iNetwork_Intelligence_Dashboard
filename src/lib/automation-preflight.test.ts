import {describe,expect,it,vi} from 'vitest';
import {runAutomationPreflight} from './automation-preflight';
import {normalizeAutomationDraft} from './automation-config';
const config=normalizeAutomationDraft({name:'Test',affiliateId:436,campaignId:146,testMode:'single_offer',strategy:'equal_slots',objective:'sale_first',offers:[{offerId:57,offerName:'Singles69',landingpages:[{familyKey:'a',familyName:'A',offerUrlId:5701,offerUrlName:'A',status:'active'},{familyKey:'b',familyName:'B',offerUrlId:5702,offerUrlName:'B',status:'active'}]}],schedule:{intervalMinutes:120},thresholds:{targetSois:50,minClicks:500,minAgeHours:24,maxAgeHours:336,maturityHours:168,minIndependentFirstSales:3,minIndependentPayers:3},weights:{mode:'equal'}});
const baseline={campaign:{network_campaign_id:146,network_affiliate_id:436,campaign_name:'Test',campaign_status:'active',network_tracking_domain_id:6450,redirect_routing_type:'weight',is_open_to_affiliates:false,is_use_secure_link:true,relationship:{redirects:{entries:[]},labels:{entries:[]}}},fingerprint:'sha256:abc'};
describe('automation preflight',()=>{
 it('accepts only complete active and affiliate-visible canonical inventory',async()=>{
  const result=await runAutomationPreflight(config,'key',{readBaseline:vi.fn().mockResolvedValue(baseline),searchOffers:vi.fn().mockResolvedValue([{offerId:57,name:'Singles69',status:'active'}]),loadLandingpages:vi.fn().mockResolvedValue([{offerId:57,visible:true,landingpages:[{offerUrlId:5701,name:'A',status:'active'},{offerUrlId:5702,name:'B',status:'active'}]}])});
  expect(result).toEqual({verified:true,fingerprint:'sha256:abc',blockers:[]});
 });
 it('fails closed on missing visibility, paused offers or missing URL IDs',async()=>{
  const result=await runAutomationPreflight(config,'key',{readBaseline:vi.fn().mockResolvedValue(baseline),searchOffers:vi.fn().mockResolvedValue([{offerId:57,name:'Singles69',status:'paused'}]),loadLandingpages:vi.fn().mockResolvedValue([{offerId:57,visible:false,landingpages:[{offerUrlId:5701,name:'A',status:'active'}]}])});
  expect(result.verified).toBe(false);
  expect(result.blockers).toEqual(expect.arrayContaining(['Offer #57 ist nicht aktiv.','Offer #57 ist für Affiliate #436 nicht sichtbar.','Offer-URL #5702 ist im aktiven Everflow-Inventar nicht vorhanden.']));
 });
});
