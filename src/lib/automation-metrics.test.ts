import {describe,expect,it} from 'vitest';
import {buildAutomationVariantMetrics} from './automation-metrics';
import {normalizeAutomationDraft} from './automation-config';

const rotationStartEpoch=Date.parse('2026-07-22T12:00:00Z')/1000;
const now=new Date('2026-07-30T12:00:00Z');
const config=normalizeAutomationDraft({name:'Test',affiliateId:436,campaignId:146,testMode:'single_offer',strategy:'equal_slots',objective:'sale_first',offers:[{offerId:57,offerName:'Singles69',landingpages:[{familyKey:'a',familyName:'A',offerUrlId:5701,offerUrlName:'A',status:'active'},{familyKey:'b',familyName:'B',offerUrlId:5702,offerUrlName:'B',status:'active'}]}],schedule:{intervalMinutes:120},thresholds:{targetSois:50,minClicks:500,minAgeHours:24,maxAgeHours:336,maturityHours:168,minIndependentFirstSales:3,minIndependentPayers:3},weights:{mode:'equal'}});
const metrics={clicks:1000,sois:50,cvr:5,firstSales:3,firstSaleRate:6,rebills:1,coinSpend:0,revenue:100,payout:150,profit:-50,profitEpc:-0.05};
const relationship={affiliate:{network_affiliate_id:436},offer:{network_offer_id:57},offer_url:{network_offer_url_id:5701},campaign:{network_campaign_id:146}};
const insight={rotationStartEpoch,currentSlots:[{id:'5701',offerId:'57',metrics14:metrics},{id:'5702',offerId:'57',metrics14:{...metrics,sois:20}}],legacySlots:[]};

describe('automation metrics adapter',()=>{
 it('uses stable customer identity and filters concentration to the rotation window',()=>{
  const conversions=[
   {transaction_id:'old-event',stableCustomerId:'customer-a',conversion_unix_timestamp:rotationStartEpoch-1,event:'Sale',revenue:900,relationship},
   {transaction_id:'sale-event',stableCustomerId:'customer-a',conversion_unix_timestamp:rotationStartEpoch,event:'Sale',revenue:70,relationship},
   {transaction_id:'rebill-event',stableCustomerId:'customer-a',conversion_unix_timestamp:rotationStartEpoch+3600,event:'Rebill',revenue:20,relationship},
   {transaction_id:'sale-b',stableCustomerId:'customer-b',conversion_unix_timestamp:rotationStartEpoch+7200,event:'Sale',revenue:10,relationship},
   {transaction_id:'future',stableCustomerId:'customer-c',conversion_unix_timestamp:now.getTime()/1000+1,event:'Sale',revenue:1000,relationship},
  ];
  const result=buildAutomationVariantMetrics(config,insight,conversions,now);
  expect(result[0]).toMatchObject({offerUrlId:5701,clicks:1000,sois:50,cvr:0.05,independentPayers:2,top1RevenueShare:0.9,mature:true});
 });

 it('marks concentration unavailable when authoritative stable customer identity is absent',()=>{
  const conversions=[{transaction_id:'event-id-is-not-a-customer',conversion_unix_timestamp:rotationStartEpoch+1,event:'Sale',revenue:100,relationship}];
  const result=buildAutomationVariantMetrics(config,insight,conversions,now);
  expect(result[0]).toMatchObject({independentPayers:null,top1RevenueShare:null});
 });

 it('marks concentration unavailable when the window has zero derived payers',()=>{
  const result=buildAutomationVariantMetrics(config,insight,[],now);
  expect(result[0]).toMatchObject({independentPayers:null,top1RevenueShare:null});
 });

 it('omits active configuration slots when the rotation start or campaign-scoped provider metrics are missing',()=>{
  expect(buildAutomationVariantMetrics(config,{rotationStartEpoch:null,currentSlots:insight.currentSlots,legacySlots:[]},[],now)).toEqual([]);
  expect(buildAutomationVariantMetrics(config,{rotationStartEpoch,currentSlots:[],legacySlots:[]},[],now)).toEqual([]);
 });
});
