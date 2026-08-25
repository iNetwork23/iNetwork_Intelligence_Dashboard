const DAY_MS=86_400_000;
const iso=(ms:number)=>new Date(ms).toISOString().slice(0,10);
const parse=(day:string)=>Date.parse(`${day}T12:00:00Z`);

export function previousWindow(from:string,to:string){
 const start=parse(from),end=parse(to),length=Math.round((end-start)/DAY_MS)+1,prevEnd=start-DAY_MS;
 return{from:iso(prevEnd-(length-1)*DAY_MS),to:iso(prevEnd)};
}

import type {Metrics} from './portfolio';
import {MIN_DECISION_CLICKS,MIN_SCALE_SOIS} from './source-breakdown';

export type TrendVerdict=
 |{status:'ok';profitDelta:number;profitPercent:number|null;direction:'steigend'|'fallend'|'stabil'}
 |{status:'insufficient';reason:string};

const mature=(m:Metrics)=>m.clicks>=MIN_DECISION_CLICKS||m.sois>=MIN_SCALE_SOIS;
const IMMATURE=`unter ${MIN_DECISION_CLICKS} Klicks und ${MIN_SCALE_SOIS} SOIs`;

export function variantTrend(current:Metrics,previous:Metrics|undefined):TrendVerdict{
 if(!previous)return{status:'insufficient',reason:'Kein Vergleichszeitraum verfügbar'};
 if(!mature(current))return{status:'insufficient',reason:`Aktueller Zeitraum ${IMMATURE}`};
 if(!mature(previous))return{status:'insufficient',reason:`Vergleichszeitraum ${IMMATURE}`};
 const profitDelta=current.profit-previous.profit,
  // Prozent nur auf positiver Basis: bei negativem oder Null-Vorwert ist eine
  // Prozentangabe irreführend (−888 %-Effekte bei Vorzeichenwechsel).
  profitPercent=previous.profit>0?100*profitDelta/previous.profit:null,
  direction=profitPercent!==null&&Math.abs(profitPercent)<5?'stabil':profitDelta>0?'steigend':profitDelta<0?'fallend':'stabil';
 return{status:'ok',profitDelta,profitPercent,direction};
}

import type {AffiliateAnalysis,AffiliateVariant} from './affiliate-optimizer';

export type VariantWithTrend=AffiliateVariant&{trendVerdict:TrendVerdict};
export type AffiliateAnalysisWithTrend=Omit<AffiliateAnalysis,'variants'>&{variants:VariantWithTrend[]};
export type CockpitRow={affiliateId:string;affiliate:string;variantKey:string;offerId:string;offer:string;offerUrlId:string;offerUrl:string;profit:number;sois:number;reason:string;trendVerdict:TrendVerdict};
export type CockpitLists={losses:CockpitRow[];scales:CockpitRow[];changes:CockpitRow[];lossTotal:number;scaleTotal:number};

const row=(a:AffiliateAnalysisWithTrend,v:VariantWithTrend):CockpitRow=>({
 affiliateId:a.affiliateId,affiliate:a.affiliate,variantKey:v.key,offerId:v.offerId,offer:v.offer,
 offerUrlId:v.offerUrlId,offerUrl:v.offerUrl,profit:v.days30.profit,sois:v.days30.sois,
 reason:v.recommendation.reason,trendVerdict:v.trendVerdict});
const delta=(r:CockpitRow)=>r.trendVerdict.status==='ok'?Math.abs(r.trendVerdict.profitDelta):-1;

export function buildCockpitLists(analyses:AffiliateAnalysisWithTrend[]):CockpitLists{
 const all=analyses.flatMap(a=>a.variants.map(v=>({a,v}))),
  pick=(action:AffiliateVariant['recommendation']['action'])=>all.filter(x=>x.v.recommendation.action===action).map(x=>row(x.a,x.v)),
  losses=pick('AUSSCHALTEN').sort((x,y)=>x.profit-y.profit),
  scales=pick('SKALIEREN').sort((x,y)=>y.profit-x.profit),
  changes=all.map(x=>row(x.a,x.v)).filter(r=>r.trendVerdict.status==='ok').sort((x,y)=>delta(y)-delta(x));
 return{losses,scales,changes,
  lossTotal:losses.reduce((s,r)=>s+r.profit,0),
  scaleTotal:scales.reduce((s,r)=>s+r.profit,0)};
}
