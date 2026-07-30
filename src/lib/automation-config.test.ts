import {describe,expect,it} from 'vitest';
import {normalizeAutomationDraft,recommendAutomationThresholds,validateAutomationDraft} from './automation-config';

const single={
 name:'Offer 57 LP-Test',affiliateId:436,campaignId:146,testMode:'single_offer',strategy:'equal_slots',objective:'sale_first',
 offers:[{offerId:57,offerName:'Singles69',landingpages:[
  {familyKey:'verlangen',familyName:'Verlangen',offerUrlId:5701,offerUrlName:'Singles69 Verlangen',status:'active'},
  {familyKey:'luv2',familyName:'LUV2',offerUrlId:5702,offerUrlName:'Singles69 LUV2',status:'active'},
  {familyKey:'senior',familyName:'Senior',offerUrlId:5703,offerUrlName:'Singles69 Senior',status:'active'},
 ]}],
 schedule:{intervalMinutes:120},thresholds:{targetSois:50,minClicks:500,minAgeHours:24,maxAgeHours:336,maturityHours:336,minIndependentFirstSales:3,minIndependentPayers:3},
 weights:{mode:'equal'},
};

describe('automation configuration',()=>{
 it('normalizes a canonical single-offer draft with equal weights',()=>{
  const result=normalizeAutomationDraft(single,new Date('2026-07-30T12:00:00Z'));
  expect(result.status).toBe('draft');
  expect(result.writeEnabled).toBe(false);
  expect(result.version).toBe(1);
  expect(result.slots.map(x=>[x.offerId,x.offerUrlId,x.weight])).toEqual([[57,5701,33.34],[57,5702,33.33],[57,5703,33.33]]);
  expect(validateAutomationDraft(result)).toEqual([]);
 });

 it('keeps candidate landingpages out of the initial slots while preserving them in the offer inventory',()=>{
  const input={...single,offers:[{...single.offers[0],landingpages:[...single.offers[0].landingpages,{familyKey:'next',familyName:'Next',offerUrlId:5704,offerUrlName:'Next',status:'active',selection:'candidate'}]}]};
  const result=normalizeAutomationDraft(input,new Date('2026-07-30T12:00:00Z'));
  expect(result.slots.map(x=>x.offerUrlId)).toEqual([5701,5702,5703]);
  expect(result.offers[0].landingpages.at(-1)?.selection).toBe('candidate');
 });

 it('rejects duplicate IDs, inactive LPs and multi-offer families that are not complete',()=>{
  const input={...single,testMode:'multi_offer',strategy:'matched_rounds',offers:[
   single.offers[0],
   {offerId:50,offerName:'Sex69',landingpages:[
    {familyKey:'verlangen',familyName:'Verlangen',offerUrlId:5701,offerUrlName:'Sex69 Verlangen',status:'active'},
    {familyKey:'luv2',familyName:'LUV2',offerUrlId:5002,offerUrlName:'Sex69 LUV2',status:'paused'},
   ]},
  ]};
  const result=normalizeAutomationDraft(input,new Date('2026-07-30T12:00:00Z'));
  expect(validateAutomationDraft(result)).toEqual(expect.arrayContaining([
   'Offer-URL-ID 5701 ist mehrfach zugeordnet.',
   'Landingpage #5002 ist nicht aktiv.',
   'LP-Familie „Senior“ fehlt bei Offer #50.',
  ]));
 });

 it.each([
  ['non-finite',Number.NaN],
  ['zero',0],
  ['negative',-1],
 ])('rejects %s slot weights even when the total could appear valid',(_label,invalidWeight)=>{
  const result=normalizeAutomationDraft(single,new Date('2026-07-30T12:00:00Z'));
  result.slots[0].weight=invalidWeight;
  result.slots[1].weight=100-invalidWeight;
  result.slots[2].weight=0.01;
  expect(validateAutomationDraft(result)).toContain('Alle Startgewichte müssen endlich und größer als 0 sein.');
 });

 it('recommends a measurable lead gate and estimated duration from partner traffic',()=>{
  const rec=recommendAutomationThresholds({variantCount:3,baselineCvr:0.01,clicksPerDay:1500,soisPerDay:15,affiliateId:436});
  expect(rec.targetSois).toBeGreaterThanOrEqual(40);
  expect(rec.minClicks).toBeGreaterThanOrEqual(rec.targetSois/0.01);
  expect(rec.minAgeHours).toBe(24);
  expect(rec.maturityHours).toBe(336);
  expect(rec.estimatedDays).toBeGreaterThan(8);
  expect(rec.estimatedDays).toBeLessThan(12);
  expect(rec.confidence).toBe('recommended');
  expect(rec.rationale.join(' ')).toContain('95');
 });

 it('fails closed when no finite traffic baseline is available',()=>{
  const rec=recommendAutomationThresholds({variantCount:9,baselineCvr:Number.NaN,clicksPerDay:0,soisPerDay:0,affiliateId:32});
  expect(rec.confidence).toBe('insufficient_data');
  expect(rec.estimatedDays).toBeNull();
  expect(rec.blockers).toContain('Keine belastbare Traffic-Baseline verfügbar.');
 });
});
