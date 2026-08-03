import {describe,expect,it} from 'vitest';
import {evaluateAutomation,type AutomationVariantMetrics} from './automation-engine';
import {normalizeAutomationDraft,type AutomationObjective} from './automation-config';

const baseThresholds={targetSois:50,minClicks:500,minAgeHours:24,maxAgeHours:336,maturityHours:168,minIndependentFirstSales:3,minIndependentPayers:3};
const config=(multi=false)=>normalizeAutomationDraft({name:'Rotation',affiliateId:436,campaignId:146,testMode:multi?'multi_offer':'single_offer',strategy:multi?'matched_rounds':'equal_slots',objective:'sale_first',offers:multi?[
 {offerId:57,offerName:'Singles69',landingpages:[{familyKey:'a',familyName:'A',offerUrlId:5701,offerUrlName:'57 A',status:'active'},{familyKey:'b',familyName:'B',offerUrlId:5702,offerUrlName:'57 B',status:'active',selection:'candidate'}]},
 {offerId:50,offerName:'Sex69',landingpages:[{familyKey:'a',familyName:'A',offerUrlId:5001,offerUrlName:'50 A',status:'active'},{familyKey:'b',familyName:'B',offerUrlId:5002,offerUrlName:'50 B',status:'active',selection:'candidate'}]},
]:[{offerId:57,offerName:'Singles69',landingpages:[{familyKey:'a',familyName:'A',offerUrlId:5701,offerUrlName:'A',status:'active'},{familyKey:'b',familyName:'B',offerUrlId:5702,offerUrlName:'B',status:'active'},{familyKey:'c',familyName:'C',offerUrlId:5703,offerUrlName:'C',status:'active',selection:'candidate'}]}],schedule:{intervalMinutes:120},thresholds:baseThresholds,weights:{mode:'equal'}},new Date('2026-07-30T12:00:00Z'));
const metric=(offerUrlId:number,overrides:Partial<AutomationVariantMetrics>={}):AutomationVariantMetrics=>({offerUrlId,clicks:5000,sois:30,cvr:0.006,firstSales:0,rebills:0,revenue:0,payout:90,profit:-90,independentPayers:null,top1RevenueShare:null,ageHours:48,mature:false,...overrides});
const robust=(offerUrlId:number,overrides:Partial<AutomationVariantMetrics>={})=>metric(offerUrlId,{clicks:1000,sois:55,firstSales:4,rebills:1,revenue:300,payout:165,profit:135,independentPayers:4,top1RevenueShare:0.4,ageHours:200,mature:true,...overrides});

describe('automation decision engine',()=>{
 it('keeps collecting until SOI, click, and time gates are all reached',()=>{
  const result=evaluateAutomation(config(),[metric(5701),metric(5702)],new Date('2026-07-30T14:00:00Z'));
  expect(result.action).toMatchObject({type:'hold',reasonCode:'test_running'});
  expect(result.progress[0]).toMatchObject({remainingSois:20,remainingClicks:0,gateReached:false});
  expect(result.writesPlanned).toBe(0);
 });

 it('enforces minClicks at the exact boundary before replacing a proven loser',()=>{
  const loser={sois:55,firstSales:2,revenue:100,payout:90,profit:10,independentPayers:2,top1RevenueShare:0.6,ageHours:200,mature:true};
  const below=evaluateAutomation(config(),[metric(5701,{...loser,clicks:499}),robust(5702)]);
  expect(below.action).toMatchObject({type:'hold',reasonCode:'test_running'});
  expect(below.progress[0]).toMatchObject({remainingClicks:1,gateReached:false});
  const at=evaluateAutomation(config(),[metric(5701,{...loser,clicks:500}),robust(5702)]);
  expect(at.action).toMatchObject({type:'replace_slot',reasonCode:'mature_economic_loser',fromOfferUrlIds:[5701],toOfferUrlIds:[5703]});
 });

 it('holds when zero derived payers make concentration unavailable instead of classifying a loser',()=>{
  const result=evaluateAutomation(config(),[metric(5701,{clicks:500,sois:55,ageHours:200,mature:true}),robust(5702)]);
  expect(result.action).toMatchObject({type:'hold',reasonCode:'economic_evidence_not_robust'});
  expect(result.writesPlanned).toBe(0);
 });

 it('rotates a complete matched multi-offer family only with robust evidence',()=>{
  const result=evaluateAutomation(config(true),[robust(5701),robust(5001)]);
  expect(result.action).toMatchObject({type:'rotate_round',fromOfferUrlIds:[5701,5001],toOfferUrlIds:[5702,5002]});
  expect(result.targetSlots.map(x=>[x.offerId,x.offerUrlId,x.weight])).toEqual([[57,5702,50],[50,5002,50]]);
 });

 it('fails closed when metrics for an active slot are missing',()=>{
  const result=evaluateAutomation(config(),[metric(5701)]);
  expect(result.action).toMatchObject({type:'hold',reasonCode:'metrics_incomplete'});
  expect(result.blockers).toContain('Kennzahlen für LP #5702 fehlen.');
 });
 it('holds a stale persisted full_matrix configuration without planning provider writes',()=>{const valid=config(true),stale={...valid,strategy:'full_matrix'} as never,result=evaluateAutomation(stale,[robust(5701),robust(5001)]);expect(result.action).toMatchObject({type:'hold',reasonCode:'unsupported_strategy'});expect(result.writesPlanned).toBe(0);expect(result.targetSlots).toEqual(valid.slots)});
 it('holds a stale persisted unsupported objective without planning provider writes',()=>{const valid=config(),stale={...valid,objective:'typo'} as never,result=evaluateAutomation(stale,[robust(5701),robust(5702)]);expect(result.action).toMatchObject({type:'hold',reasonCode:'unsupported_objective'});expect(result.writesPlanned).toBe(0)});
 it('holds a stale persisted unsupported weight mode without planning provider writes',()=>{const valid=config(),stale={...valid,weights:{mode:'typo'}} as never,result=evaluateAutomation(stale,[robust(5701),robust(5702)]);expect(result.action).toMatchObject({type:'hold',reasonCode:'unsupported_configuration'});expect(result.writesPlanned).toBe(0)});
 it('holds a stale persisted unsupported landingpage selection without planning provider writes',()=>{const valid=config(),stale={...valid,offers:[{...valid.offers[0],landingpages:[{...valid.offers[0].landingpages[0],selection:'typo'},...valid.offers[0].landingpages.slice(1)]}]} as never,result=evaluateAutomation(stale,[robust(5701),robust(5702)]);expect(result.action).toMatchObject({type:'hold',reasonCode:'unsupported_configuration'});expect(result.writesPlanned).toBe(0)});
});

function objectiveConfig(objective:AutomationObjective){
 return normalizeAutomationDraft({name:'Objectives',affiliateId:436,campaignId:146,testMode:'single_offer',strategy:'champion_challenger',objective,offers:[{offerId:57,offerName:'Singles69',landingpages:[
  {familyKey:'a',familyName:'A',offerUrlId:5701,offerUrlName:'A',status:'active'},
  {familyKey:'b',familyName:'B',offerUrlId:5702,offerUrlName:'B',status:'active'},
  {familyKey:'c',familyName:'C',offerUrlId:5703,offerUrlName:'C',status:'active'},
 ]}],schedule:{intervalMinutes:120},thresholds:{...baseThresholds,targetSois:40,minClicks:100},weights:{mode:'champion_challenger'}});
}
const objectiveMetrics=[
 robust(5701,{clicks:1000,sois:100,firstSales:12,profit:100}),
 robust(5702,{clicks:1000,sois:50,firstSales:5,profit:200}),
 robust(5703,{clicks:400,sois:40,firstSales:4,profit:120}),
];

describe.each([
 ['sale_first',5701,'robust_sale_first_leader'],
 ['profit_per_soi',5702,'robust_profit_per_soi_leader'],
 ['profit_epc',5703,'robust_profit_epc_leader'],
] as const)('%s objective',(objective,leader,reasonCode)=>{
 it('ranks mature robust variants by the configured economics',()=>{
  const result=evaluateAutomation(objectiveConfig(objective),objectiveMetrics);
  expect(result.action).toMatchObject({type:'promote',reasonCode,toOfferUrlIds:[leader]});
  expect(result.targetSlots.find(slot=>slot.offerUrlId===leader)?.weight).toBe(50);
 });
});
