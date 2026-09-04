import type {CockpitRow} from './affiliate-trend';
import type {UnitSeverity,VerdictGate} from './decision-engine';
import type {ActionCandidate} from './source-breakdown';
import {countActiveBlocks,findBlockMarker,isBlockedMarker,type SourceBlockMarker,type SourceBlockMarkerIndex} from './source-block-markers';
import {VERDICT_SEVERITY,type VerdictWord} from './verdict-vocabulary';
/**
 * Reine Priorisierung der Partnerseite (Etappe 3): aus Cockpit-Zeilen (Offer-URL-Ebene) und Tracker-Kandidaten (Source-/Sub-Source-Ebene)
 * entsteht EINE Liste. Reihenfolge: gesperrte Einheiten ans Ende, sonst |Profit| absteigend, dann Verdikt-Klasse
 * (AUSSCHALTEN vor SKALIEREN vor BEOBACHTEN/WEITER TESTEN/WEITERLAUFEN), dann Schlüssel. Keine Datenladung, keine Farben, keine Wörter.
 */
export type PriorityMetrics={clicks:number;sois:number;cvr:number;firstSales:number;rebills:number;revenue:number;profit:number};
export type PriorityPeriod={clicks:number;sois:number;cvr:number;profit:number};
export type PriorityItem={
 key:string;
 kind:'landingpage'|'source';
 affiliateId:string;affiliate:string;offerId:string;offer:string;offerUrlId:string;offerUrl:string;
 trafficMode:'api'|'tracked';
 /** Quellenidentität (nur kind 'source'); subSource null = Bewertung auf Source-Ebene. */
 sourceId:string|null;subSource:string|null;mainValue:string|null;subValue:string|null;
 action:VerdictWord;severity:UnitSeverity;reason:string;
 metrics:PriorityMetrics;
 /** Vorperiode, falls vorhanden – für Δ SOIs / Δ CVR / Δ Profit. */
 previous:PriorityPeriod|null;
 gate?:VerdictGate;
 /** Sperrstatus: Marker der eigenen Ebene (Quellen) bzw. Zahl aktiver Quellen-Sperren des Affiliate/Offer-Paars (Landingpages). */
 blockMarker:SourceBlockMarker|null;activeBlocks:number;
 /** Aktiv gesperrt → ans Ende der Liste. */
 blocked:boolean;
 /** Tageswerte (z. B. Profit je Tag) für die Sparkline; ohne Daten keine Sparkline. */
 daily?:number[];
};
export type DailyByKey=Record<string,number[]>;
const VERDICT_RANK:Record<VerdictWord,number>={AUSSCHALTEN:0,SKALIEREN:1,BEOBACHTEN:2,'WEITER TESTEN':2,WEITERLAUFEN:3};
export const verdictRank=(action:VerdictWord)=>VERDICT_RANK[action]??2;
/** Schlüssel einer Cockpit-Zeile (Affiliate + Variante) – auch der Schlüssel für dailyByKey. */
export const cockpitItemKey=(row:Pick<CockpitRow,'affiliateId'|'variantKey'>)=>`${row.affiliateId}|${row.variantKey}`;
/** Schlüssel eines Tracker-Kandidaten – identisch mit dem Aggregationsschlüssel in aggregateSourceRows (pathKey|mode|main|sub). */
export const candidateItemKey=(c:Pick<ActionCandidate,'pathKey'|'trafficMode'|'mainValue'|'subValue'>)=>`${c.pathKey}|${c.trafficMode}|${c.mainValue||''}|${c.subValue||''}`;
export function cockpitPriorityItems(rows:CockpitRow[],blocks?:SourceBlockMarkerIndex,dailyByKey?:DailyByKey):PriorityItem[]{
 return rows.map(row=>{const key=cockpitItemKey(row),previous=row.trendVerdict.previous??null,daily=dailyByKey?.[key];return{
  key,kind:'landingpage',affiliateId:row.affiliateId,affiliate:row.affiliate,offerId:row.offerId,offer:row.offer,offerUrlId:row.offerUrlId,offerUrl:row.offerUrl,trafficMode:row.trafficMode,
  sourceId:null,subSource:null,mainValue:null,subValue:null,
  action:row.action,severity:row.severity,reason:row.reason,
  metrics:{clicks:row.clicks,sois:row.sois,cvr:row.cvr,firstSales:row.firstSales,rebills:row.rebills,revenue:row.revenue,profit:row.profit},
  previous:previous?{clicks:previous.clicks,sois:previous.sois,cvr:previous.cvr,profit:previous.profit}:null,
  gate:row.gate,blockMarker:null,activeBlocks:countActiveBlocks(blocks,row.affiliateId,row.offerId),blocked:false,
  ...(daily&&daily.length>1?{daily}:{}),
 } satisfies PriorityItem});
}
export type CandidateContext={affiliate:string;offer:string;urls:Record<string,string>};
export function candidatePriorityItems(candidates:ActionCandidate[],context:CandidateContext,blocks?:SourceBlockMarkerIndex,dailyByKey?:DailyByKey):PriorityItem[]{
 return candidates.map(c=>{const key=candidateItemKey(c),marker=findBlockMarker(blocks,c),daily=dailyByKey?.[key];return{
  key,kind:'source',affiliateId:c.affiliateId,affiliate:context.affiliate,offerId:c.offerId,offer:context.offer,offerUrlId:c.offerUrlId,offerUrl:context.urls[c.offerUrlId]||`URL #${c.offerUrlId}`,trafficMode:c.trafficMode,
  sourceId:c.sourceId,subSource:c.subSource,mainValue:c.mainValue,subValue:c.subValue,
  action:c.assessment.action,severity:VERDICT_SEVERITY[c.assessment.action],reason:c.assessment.reason,
  metrics:{clicks:c.metric.clicks,sois:c.metric.sois,cvr:c.metric.cvr,firstSales:c.metric.firstSales,rebills:c.metric.rebills,revenue:c.metric.revenue,profit:c.metric.profit},
  previous:null,gate:c.assessment.gate,blockMarker:marker,activeBlocks:0,blocked:isBlockedMarker(marker),
  ...(daily&&daily.length>1?{daily}:{}),
 } satisfies PriorityItem});
}
const compare=(a:PriorityItem,b:PriorityItem)=>Number(a.blocked)-Number(b.blocked)||Math.abs(b.metrics.profit)-Math.abs(a.metrics.profit)||verdictRank(a.action)-verdictRank(b.action)||a.key.localeCompare(b.key);
/** Stabile Sortierung nach Profit-Wirkung, Verdikt-Klasse und Sperrstatus; Eingabe bleibt unverändert. */
export const prioritizeItems=(items:PriorityItem[])=>[...items].sort(compare);
export type PriorityCounts={AUSSCHALTEN:number;SKALIEREN:number;other:number;blocked:number};
export type PriorityList={items:PriorityItem[];counts:PriorityCounts;lossTotal:number;scaleTotal:number};
export function buildPriorityList(items:PriorityItem[]):PriorityList{
 const sorted=prioritizeItems(items),counts:PriorityCounts={AUSSCHALTEN:0,SKALIEREN:0,other:0,blocked:0};
 let lossTotal=0,scaleTotal=0;
 for(const item of sorted){
  if(item.blocked){counts.blocked++;continue}
  if(item.action==='AUSSCHALTEN'){counts.AUSSCHALTEN++;lossTotal+=item.metrics.profit}
  else if(item.action==='SKALIEREN'){counts.SKALIEREN++;scaleTotal+=item.metrics.profit}
  else counts.other++;
 }
 return{items:sorted,counts,lossTotal,scaleTotal};
}
/** Tracker-Kandidaten mit Handlungsbedarf: AUSSCHALTEN und SKALIEREN immer, BEOBACHTEN nur bei negativem Profit (wie das Quellen-Rollup). */
export const isActionable=(item:Pick<PriorityItem,'action'|'metrics'>)=>item.action==='AUSSCHALTEN'||item.action==='SKALIEREN'||(item.action==='BEOBACHTEN'&&item.metrics.profit<0);
