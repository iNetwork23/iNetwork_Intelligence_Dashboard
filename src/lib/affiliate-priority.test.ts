import {describe,expect,it} from 'vitest';
import {buildPriorityList,candidateItemKey,candidatePriorityItems,cockpitItemKey,cockpitPriorityItems,isActionable,prioritizeItems,verdictRank,type PriorityItem} from './affiliate-priority';
import type {CockpitRow} from './affiliate-trend';
import type {ActionCandidate,ConversionMetric} from './source-breakdown';
import {sourceBlockMarkerIndex,sourceRowBlockKeys,type SourceBlockMarkerIndex} from './source-block-markers';

const row=(key:string,profit:number,action:CockpitRow['action']='AUSSCHALTEN',extra:Partial<CockpitRow>={}):CockpitRow=>({affiliateId:'154',affiliate:'Partner 154',variantKey:key,offerId:'20',offer:'Offer 20',offerUrlId:key,offerUrl:`URL ${key}`,trafficMode:'tracked',profit,sois:30,clicks:300,cvr:10,firstSales:3,rebills:1,revenue:100,action,severity:'neutral',reason:`Grund ${key}`,trendVerdict:{status:'insufficient',reason:'x'},...extra});
const metric=(x:Partial<ConversionMetric>):ConversionMetric=>({clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,payout:0,revenue:0,profit:0,profitPerSoi:0,...x});
const candidate=(sub:string,profit:number,action:ActionCandidate['assessment']['action']='AUSSCHALTEN'):ActionCandidate=>({pathKey:'20|154|0|1',offerId:'20',affiliateId:'154',offerUrlId:'1',trafficMode:'tracked',mainValue:'Source A',subValue:sub,sourceId:'Source A',subSource:sub,metric:metric({clicks:300,sois:0,profit}),assessment:{action,severity:action==='AUSSCHALTEN'?'critical':action==='SKALIEREN'?'positive':'neutral',reason:`Grund ${sub}`},activity:{lastLeadDate:null,asOf:'2026-09-01',coverageComplete:true,lookbackDays:365}});
const marker=(key:string,status:'active'|'error'):SourceBlockMarkerIndex=>({[key]:{id:`b-${key}`,status,effectiveAt:'2026-09-03T08:15:00.000Z',affiliateId:'154',offerId:'20'}});
const subKey=(sub:string)=>sourceRowBlockKeys({affiliateId:'154',offerId:'20',trafficMode:'tracked',mainValue:'Source A',subValue:sub})[0];

describe('Priorisierung: eine Liste aus Cockpit-Zeilen und Tracker-Kandidaten',()=>{
  it('ranks verdict classes AUSSCHALTEN before SKALIEREN before BEOBACHTEN/WEITER TESTEN',()=>{
    expect(verdictRank('AUSSCHALTEN')).toBeLessThan(verdictRank('SKALIEREN'));
    expect(verdictRank('SKALIEREN')).toBeLessThan(verdictRank('BEOBACHTEN'));
    expect(verdictRank('BEOBACHTEN')).toBe(verdictRank('WEITER TESTEN'));
  });
  it('sorts by absolute profit impact first, then verdict class, and keeps the input untouched',()=>{
    const input=cockpitPriorityItems([row('small-loss',-50),row('big-win',900,'SKALIEREN'),row('big-loss',-500),row('watch',-500,'BEOBACHTEN'),row('same',-500,'SKALIEREN')]);
    const before=input.map(item=>item.key);
    expect(prioritizeItems(input).map(item=>item.key)).toEqual(['154|big-win','154|big-loss','154|same','154|watch','154|small-loss']);
    expect(input.map(item=>item.key)).toEqual(before);
  });
  it('moves actively blocked units to the end with their marker while unclear blocks stay in place',()=>{
    const blocks={...marker(subKey('sub-1'),'active'),...marker(subKey('sub-2'),'error')};
    const items=candidatePriorityItems([candidate('sub-1',-900),candidate('sub-2',-300),candidate('sub-3',-100)],{affiliate:'Partner',offer:'Offer',urls:{'1':'lp.example'}},blocks);
    const list=buildPriorityList(items);
    expect(list.items.map(item=>item.subSource)).toEqual(['sub-2','sub-3','sub-1']);
    expect(list.items[2]).toMatchObject({blocked:true,blockMarker:{status:'active'}});
    expect(list.items[0]).toMatchObject({blocked:false,blockMarker:{status:'error'}});
    expect(list.counts).toEqual({AUSSCHALTEN:2,SKALIEREN:0,other:0,blocked:1});
    expect(list.lossTotal).toBe(-400);
  });
  it('carries identity, verdict, metrics, gate and the offer-url name onto candidate items',()=>{
    const [item]=candidatePriorityItems([{...candidate('sub-1',-900),assessment:{action:'AUSSCHALTEN',severity:'critical',reason:'r',gate:{matureSois:1,totalSois:2,requiredSois:50,maturityReached:false,p75Hours:null,latencyConfidence:'nicht geprüft',rateLow:0,rateHigh:1,benchmarkRate:null,confidence:'unsicher'}}}],{affiliate:'Partner',offer:'Offer',urls:{'1':'lp.example'}});
    expect(item).toMatchObject({kind:'source',affiliate:'Partner',offer:'Offer',offerUrl:'lp.example',sourceId:'Source A',subSource:'sub-1',mainValue:'Source A',subValue:'sub-1',action:'AUSSCHALTEN',severity:'critical',metrics:{clicks:300,sois:0,profit:-900},previous:null});
    expect(item.gate?.confidence).toBe('unsicher');
    expect(item.key).toBe(candidateItemKey(candidate('sub-1',-900)));
    expect(item.key).toBe('20|154|0|1|tracked|Source A|sub-1');
  });
  it('carries previous-period metrics, gate and the affiliate/offer block count onto cockpit items',()=>{
    const blocks=sourceBlockMarkerIndex(new Map());
    const [item]=cockpitPriorityItems([row('a',-500,'AUSSCHALTEN',{trendVerdict:{status:'ok',profitDelta:1,profitPercent:null,direction:'steigend',previous:{clicks:200,sois:20,cvr:10,profit:-501}}})],blocks,{[cockpitItemKey({affiliateId:'154',variantKey:'a'})]:[1,2,3]});
    expect(item).toMatchObject({kind:'landingpage',previous:{clicks:200,sois:20,cvr:10,profit:-501},activeBlocks:0,blocked:false,daily:[1,2,3]});
    expect(cockpitPriorityItems([row('a',-1)])[0].daily).toBeUndefined();
    expect(cockpitPriorityItems([row('a',-1)],undefined,{'154|a':[5]})[0].daily).toBeUndefined();
  });
  it('treats BEOBACHTEN as actionable only with negative profit (mirrors the source rollup)',()=>{
    const item=(action:PriorityItem['action'],profit:number)=>({action,metrics:{clicks:0,sois:0,cvr:0,firstSales:0,rebills:0,revenue:0,profit}});
    expect(isActionable(item('AUSSCHALTEN',0))).toBe(true);
    expect(isActionable(item('SKALIEREN',0))).toBe(true);
    expect(isActionable(item('BEOBACHTEN',-1))).toBe(true);
    expect(isActionable(item('BEOBACHTEN',0))).toBe(false);
    expect(isActionable(item('WEITER TESTEN',-5))).toBe(false);
  });
});
