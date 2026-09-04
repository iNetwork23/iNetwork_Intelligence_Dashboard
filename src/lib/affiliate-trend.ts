const DAY_MS=86_400_000;
const iso=(ms:number)=>new Date(ms).toISOString().slice(0,10);
const parse=(day:string)=>Date.parse(`${day}T12:00:00Z`);

export function previousWindow(from:string,to:string){
 const start=parse(from),end=parse(to),length=Math.round((end-start)/DAY_MS)+1,prevEnd=start-DAY_MS;
 return{from:iso(prevEnd-(length-1)*DAY_MS),to:iso(prevEnd)};
}

import type {Metrics} from './portfolio';
import {MIN_DECISION_CLICKS,MIN_SCALE_SOIS} from './source-breakdown';

/** Vorperiode in den Feldern, die Δ SOIs / Δ CVR / Δ Profit brauchen (Etappe 3) – nur gesetzt, wenn ein Vergleichsfenster existiert. */
export type TrendPeriodMetrics={clicks:number;sois:number;cvr:number;profit:number};
export type TrendVerdict=(
 |{status:'ok';profitDelta:number;profitPercent:number|null;direction:'steigend'|'fallend'|'stabil'}
 |{status:'insufficient';reason:string})&{previous?:TrendPeriodMetrics};
const periodMetrics=(m:Metrics):TrendPeriodMetrics=>({clicks:m.clicks,sois:m.sois,cvr:m.cvr,profit:m.profit});

const mature=(m:Metrics)=>m.clicks>=MIN_DECISION_CLICKS||m.sois>=MIN_SCALE_SOIS;
const IMMATURE=`unter ${MIN_DECISION_CLICKS} Klicks und ${MIN_SCALE_SOIS} SOIs`;

export function variantTrend(current:Metrics,previous:Metrics|undefined):TrendVerdict{
 if(!previous)return{status:'insufficient',reason:'Kein Vergleichszeitraum verfügbar'};
 const prev=periodMetrics(previous);
 if(!mature(current))return{status:'insufficient',reason:`Aktueller Zeitraum ${IMMATURE}`,previous:prev};
 if(!mature(previous))return{status:'insufficient',reason:`Vergleichszeitraum ${IMMATURE}`,previous:prev};
 const profitDelta=current.profit-previous.profit,
  // Prozent nur auf positiver Basis: bei negativem oder Null-Vorwert ist eine
  // Prozentangabe irreführend (−888 %-Effekte bei Vorzeichenwechsel).
  profitPercent=previous.profit>0?100*profitDelta/previous.profit:null,
  direction=profitPercent!==null&&Math.abs(profitPercent)<5?'stabil':profitDelta>0?'steigend':profitDelta<0?'fallend':'stabil';
 return{status:'ok',profitDelta,profitPercent,direction,previous:prev};
}

import type {AffiliateAnalysis,AffiliateVariant} from './affiliate-optimizer';
import type {VerdictGate} from './decision-engine';

export type VariantWithTrend=AffiliateVariant&{trendVerdict:TrendVerdict};
export type AffiliateAnalysisWithTrend=Omit<AffiliateAnalysis,'variants'>&{variants:VariantWithTrend[]};
/** Eine Cockpit-Zeile = eine Offer-URL-Variante eines Partners mit Verdikt, Volumen, Vorperiode (über trendVerdict.previous) und – sobald die Engine sie liefert – dem Konfidenz-Gate. */
export type CockpitRow={affiliateId:string;affiliate:string;variantKey:string;offerId:string;offer:string;offerUrlId:string;offerUrl:string;trafficMode:'api'|'tracked';profit:number;sois:number;clicks:number;cvr:number;firstSales:number;rebills:number;revenue:number;action:AffiliateVariant['recommendation']['action'];severity:AffiliateVariant['recommendation']['severity'];reason:string;gate?:VerdictGate;trendVerdict:TrendVerdict};
export type CockpitLists={all:CockpitRow[];losses:CockpitRow[];scales:CockpitRow[];changes:CockpitRow[];lossTotal:number;scaleTotal:number};

/** Das Gate hängt an der Empfehlung, sobald affiliate-optimizer.ts es aus assessUnit durchreicht; bis dahin bleibt es undefined (Anzeige „Konfidenz: nicht berechnet“). */
const recommendationGate=(v:VariantWithTrend):VerdictGate|undefined=>(v.recommendation as {gate?:VerdictGate}).gate;
export const cockpitRow=(a:AffiliateAnalysisWithTrend,v:VariantWithTrend):CockpitRow=>({
 affiliateId:a.affiliateId,affiliate:a.affiliate,variantKey:v.key,offerId:v.offerId,offer:v.offer,
 offerUrlId:v.offerUrlId,offerUrl:v.offerUrl,trafficMode:v.trafficMode,profit:v.days30.profit,sois:v.days30.sois,
 clicks:v.days30.clicks,cvr:v.days30.cvr,firstSales:v.days30.firstSales,rebills:v.days30.rebills,revenue:v.days30.revenue,
 action:v.recommendation.action,severity:v.recommendation.severity,reason:v.recommendation.reason,gate:recommendationGate(v),trendVerdict:v.trendVerdict});
const row=cockpitRow;
const delta=(r:CockpitRow)=>r.trendVerdict.status==='ok'?Math.abs(r.trendVerdict.profitDelta):-1;

export function buildCockpitLists(analyses:AffiliateAnalysisWithTrend[]):CockpitLists{
 const all=analyses.flatMap(a=>a.variants.map(v=>({a,v}))),
  pick=(action:AffiliateVariant['recommendation']['action'])=>all.filter(x=>x.v.recommendation.action===action).map(x=>row(x.a,x.v)),
  losses=pick('AUSSCHALTEN').sort((x,y)=>x.profit-y.profit),
  scales=pick('SKALIEREN').sort((x,y)=>y.profit-x.profit),
  changes=all.map(x=>row(x.a,x.v)).filter(r=>r.trendVerdict.status==='ok').sort((x,y)=>delta(y)-delta(x));
 return{all:all.map(x=>row(x.a,x.v)),losses,scales,changes,
  lossTotal:losses.reduce((s,r)=>s+r.profit,0),
  scaleTotal:scales.reduce((s,r)=>s+r.profit,0)};
}

/** Jüngster SOI-Tag je Affiliate aus daily_metrics-Zeilen — Tage ohne SOIs zählen nicht. */
export function lastLeadByAffiliate(rows:Array<{affiliate_id:string;metric_date:string;sois:number|string}>):Map<string,string>{
 const map=new Map<string,string>();
 for(const row of rows){
  if(!Number(row.sois))continue;
  const current=map.get(row.affiliate_id);
  if(!current||row.metric_date>current)map.set(row.affiliate_id,row.metric_date);
 }
 return map;
}
