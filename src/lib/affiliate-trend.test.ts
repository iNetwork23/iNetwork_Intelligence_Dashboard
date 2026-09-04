import {describe,expect,it} from 'vitest';
import {previousWindow} from './affiliate-trend';

describe('previousWindow',()=>{
  it('returns the equally long window ending the day before',()=>{
    expect(previousWindow('2026-08-01','2026-08-30')).toEqual({from:'2026-07-02',to:'2026-07-31'});
  });
  it('handles a single day',()=>{
    expect(previousWindow('2026-08-23','2026-08-23')).toEqual({from:'2026-08-22',to:'2026-08-22'});
  });
  it('crosses a year boundary',()=>{
    expect(previousWindow('2026-01-01','2026-01-07')).toEqual({from:'2025-12-25',to:'2025-12-31'});
  });
});

import {variantTrend} from './affiliate-trend';
import type {Metrics} from './portfolio';
const m=(x:Partial<Metrics>):Metrics=>({clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,payout:0,revenue:0,profit:0,profitEpc:0,...x});

describe('variantTrend',()=>{
  it('reports a rising trend when both windows are mature',()=>{
    expect(variantTrend(m({clicks:200,profit:300}),m({clicks:200,profit:100}))).toEqual({status:'ok',profitDelta:200,profitPercent:200,direction:'steigend',previous:{clicks:200,sois:0,cvr:0,profit:100}});
  });
  it('reports a falling trend',()=>{
    expect(variantTrend(m({sois:40,profit:50}),m({sois:40,profit:100}))).toMatchObject({status:'ok',profitDelta:-50,direction:'fallend'});
  });
  it('calls a change under five percent stable',()=>{
    expect(variantTrend(m({clicks:200,profit:102}),m({clicks:200,profit:100}))).toMatchObject({direction:'stabil'});
  });
  it('refuses a verdict when the current window is immature',()=>{
    expect(variantTrend(m({clicks:99,sois:19,profit:300}),m({clicks:200,profit:100}))).toEqual({status:'insufficient',reason:'Aktueller Zeitraum unter 100 Klicks und 20 SOIs',previous:{clicks:200,sois:0,cvr:0,profit:100}});
  });
  it('refuses a verdict when the previous window is immature',()=>{
    expect(variantTrend(m({clicks:200,profit:300}),m({clicks:5,profit:1}))).toEqual({status:'insufficient',reason:'Vergleichszeitraum unter 100 Klicks und 20 SOIs',previous:{clicks:5,sois:0,cvr:0,profit:1}});
  });
  it('refuses a verdict when there is no previous window',()=>{
    expect(variantTrend(m({clicks:200,profit:300}),undefined)).toEqual({status:'insufficient',reason:'Kein Vergleichszeitraum verfügbar'});
  });
  it('omits the percentage when the previous profit is zero',()=>{
    expect(variantTrend(m({clicks:200,profit:80}),m({clicks:200,profit:0}))).toMatchObject({status:'ok',profitDelta:80,profitPercent:null,direction:'steigend'});
  });
  it('omits the percentage on a negative base — sign flips carry the delta alone',()=>{
    expect(variantTrend(m({clicks:200,profit:300}),m({clicks:200,profit:-100}))).toMatchObject({status:'ok',profitDelta:400,profitPercent:null,direction:'steigend'});
  });
});

import {buildCockpitLists,type AffiliateAnalysisWithTrend,type VariantWithTrend} from './affiliate-trend';
import type {AffiliateVariant} from './affiliate-optimizer';

const variant=(key:string,action:AffiliateVariant['recommendation']['action'],profit:number,trendDelta:number|null):VariantWithTrend=>({
 key,offerId:'20',offer:'Offer 20',offerUrlId:key,offerUrl:`URL ${key}`,trafficType:'Direkt',trafficMode:'tracked',
 days30:m({profit,sois:30}),
 efficiency:{label:'Profit je Klick',days30:0},
 recommendation:{action,severity:'neutral',reason:`Grund ${key}`,evidence:[]},
 trendVerdict:trendDelta===null?{status:'insufficient',reason:'Kein Vergleichszeitraum verfügbar'}:{status:'ok',profitDelta:trendDelta,profitPercent:10,direction:trendDelta>0?'steigend':'fallend'},
});
const analysis=(affiliateId:string,variants:VariantWithTrend[]):AffiliateAnalysisWithTrend=>({affiliateId,affiliate:`Partner ${affiliateId}`,variants,totals30:m({}),bestVariantKey:variants[0]?.key||'',summary:''});

describe('buildCockpitLists',()=>{
  const lists=()=>buildCockpitLists([
    analysis('154',[variant('a','AUSSCHALTEN',-500,-40),variant('b','SKALIEREN',900,120)]),
    analysis('200',[variant('c','AUSSCHALTEN',-120,null),variant('d','SKALIEREN',300,-800)]),
  ]);
  it('lists every loss across all partners, worst first',()=>{
    expect(lists().losses.map(r=>r.variantKey)).toEqual(['a','c']);
  });
  it('lists every scale candidate, best first',()=>{
    expect(lists().scales.map(r=>r.variantKey)).toEqual(['b','d']);
  });
  it('sums the lists',()=>{
    expect(lists().lossTotal).toBe(-620);
    expect(lists().scaleTotal).toBe(1200);
  });
  it('ranks changes by absolute delta and excludes immature verdicts',()=>{
    expect(lists().changes.map(r=>r.variantKey)).toEqual(['d','b','a']);
  });
  it('carries the partner identity onto every row',()=>{
    expect(lists().losses[1]).toMatchObject({affiliateId:'200',affiliate:'Partner 200',reason:'Grund c'});
  });
  it('carries verdict, volume, traffic mode and the (still optional) gate onto every row and keeps the full list',()=>{
    const all=lists().all;
    expect(all.map(r=>r.variantKey)).toEqual(['a','b','c','d']);
    expect(all[0]).toMatchObject({action:'AUSSCHALTEN',severity:'neutral',trafficMode:'tracked',sois:30,clicks:0,cvr:0,firstSales:0,rebills:0,revenue:0});
    expect(all[0].gate).toBeUndefined();
    const withGate={...variant('g','AUSSCHALTEN',-1,null),recommendation:{...variant('g','AUSSCHALTEN',-1,null).recommendation,gate:{matureSois:50,totalSois:60,requiredSois:50,maturityReached:true,p75Hours:30,latencyConfidence:'hoch' as const,rateLow:0,rateHigh:0.05,benchmarkRate:0.04,confidence:'belastbar' as const}}};
    expect(buildCockpitLists([analysis('1',[withGate])]).all[0].gate?.matureSois).toBe(50);
  });
});

import{activityMemoFingerprint,isValidActivityMemo}from'./cached-evaluations';
describe('activity memo invalidation',()=>{
  const marker=(date:string,generation:string)=>({version:4,date,generation});
  it('changes the fingerprint when the newest snapshot generation changes',()=>{
    const before=activityMemoFingerprint([marker('2026-08-23','g1'),marker('2026-08-24','g2')]);
    const after=activityMemoFingerprint([marker('2026-08-23','g1'),marker('2026-08-24','g3')]);
    expect(before).not.toBe(after);
  });
  it('changes the fingerprint when a backfill adds days',()=>{
    const before=activityMemoFingerprint([marker('2026-08-24','g2')]);
    const after=activityMemoFingerprint([marker('2026-08-23','g1'),marker('2026-08-24','g2')]);
    expect(before).not.toBe(after);
  });
  it('accepts a memo only with matching fingerprint and entry list',()=>{
    const fp=activityMemoFingerprint([marker('2026-08-24','g2')]);
    expect(isValidActivityMemo({fingerprint:fp,entries:[]},fp)).toBe(true);
    expect(isValidActivityMemo({fingerprint:'anders',entries:[]},fp)).toBe(false);
    expect(isValidActivityMemo({fingerprint:fp},fp)).toBe(false);
  });
});

import{decodeActivityEntries,encodeActivityEntries}from'./cached-evaluations';
describe('activity memo tuple codec',()=>{
  it('round-trips identity and last lead date',()=>{
    const entries=[{identity:{pathKey:'20|460|0|2762',offerId:'20',affiliateId:'460',offerUrlId:'2762',sourceId:'32',subSource:'de',trafficMode:'tracked' as const,mainValue:'32',subValue:'de'},lastLeadDate:'2026-08-23'},
                   {identity:{pathKey:'20|460|0|2762',offerId:'20',affiliateId:'460',offerUrlId:'2762',sourceId:'Ohne Source-ID',subSource:'Ohne Sub-Source',trafficMode:'api' as const,mainValue:null,subValue:null},lastLeadDate:null}];
    expect(decodeActivityEntries(encodeActivityEntries(entries))).toEqual(entries);
  });
});

import{lastLeadByAffiliate}from'./affiliate-trend';
describe('last lead per affiliate',()=>{
  it('keeps the newest soi day per affiliate',()=>{
    const rows=[
      {affiliate_id:'63',metric_date:'2026-08-20',sois:3},
      {affiliate_id:'63',metric_date:'2026-08-24',sois:1},
      {affiliate_id:'6',metric_date:'2026-08-25',sois:9},
      {affiliate_id:'6',metric_date:'2026-08-25',sois:2},
      {affiliate_id:'154',metric_date:'2026-08-10',sois:0},
    ];
    expect(lastLeadByAffiliate(rows)).toEqual(new Map([['63','2026-08-24'],['6','2026-08-25']]));
  });
});
