import type{ConversionRow}from'./everflow';
import type{LeadMaturityInput}from'./decision-engine';
import{isDirectSoi,type LeadLatencyAnalysis}from'./lead-latency';
import{canonicalTrackedSub}from'./click-id-sub-source';
import{berlinRangeUtcBounds}from'./reporting-day';
/**
 * Reife-Index (Etappe 3, D3): je Blatt (Offer, Offer-URL, Traffic-Modus, Haupt-/Unterquelle) und je Offer-URL die Zahl der SOIs im
 * Fenster, die mindestens die typische Wartezeit (p75 der Latenzanalyse) hinter sich haben. Reine Funktionen, serialisierbar (Records
 * statt Maps), damit der Index als Prop in Client-Bausteine wandern kann.
 */
export const LEAD_MATURITY_FALLBACK_HOURS=72;
export type LeadMaturityIdentity={offerId:string;offerUrlId:string;trafficMode:'api'|'tracked';mainValue:string|null;subValue:string|null};
export type LeadMaturityIndex={byLeaf:Record<string,LeadMaturityInput>;byUrl:Record<string,LeadMaturityInput>;confidence:LeadMaturityInput['confidence'];p75Hours:number;fallbackUsed:boolean;range:{from:string;to:string};generatedAt:string};
const PLACEHOLDERS=['N/A','Ohne Source-ID','Ohne Sub-Source','Nicht übermittelt'];
/** Gleiche Normalisierung wie normalizeSourceBlockInput: trimmen, Platzhalter → null. */
export const normalizedLeafValue=(value:unknown)=>{if(value===undefined||value===null)return null;const text=String(value).trim();return!text||PLACEHOLDERS.includes(text)?null:text};
export const leafMaturityKey=(id:LeadMaturityIdentity)=>`${id.offerId}|${id.offerUrlId}|${id.trafficMode}|${normalizedLeafValue(id.mainValue)??''}|${normalizedLeafValue(id.subValue)??''}`;
export const urlMaturityKey=(offerId:string,offerUrlId:string)=>`${offerId}|${offerUrlId}`;
/** p75 der Analyse; Fallback 72 h ohne belastbare Latenz (p75 fehlt oder Konfidenz niedrig/keine Daten). */
export const effectiveP75Hours=(analysis:Pick<LeadLatencyAnalysis,'p75Hours'|'confidence'>)=>analysis.p75Hours!==null&&Number.isFinite(analysis.p75Hours)&&(analysis.confidence==='hoch'||analysis.confidence==='mittel')?{p75Hours:analysis.p75Hours,fallbackUsed:false}:{p75Hours:LEAD_MATURITY_FALLBACK_HOURS,fallbackUsed:true};
type Raw=ConversionRow&{adv1?:string|null;adv2?:string|null;sub2?:string|null};
/** Blattidentität einer Conversion wie in aggregateSourceRows: API → adv1/adv2, sonst source_id/sub1 (Klick-IDs in sub1 über sub2 kanonisiert). */
export function conversionLeafIdentity(row:ConversionRow):LeadMaturityIdentity{const raw=row as Raw,trafficMode=raw.traffic_mode==='api'?'api' as const:'tracked' as const,main=trafficMode==='api'?raw.adv1:raw.source_id,subRaw=trafficMode==='api'?raw.adv2:raw.sub1,sub=canonicalTrackedSub(String(subRaw??''),trafficMode==='api'?'':String(raw.sub2??''));return{offerId:String(row.relationship?.offer?.network_offer_id||0),offerUrlId:String(row.relationship?.offer_url?.network_offer_url_id||0),trafficMode,mainValue:normalizedLeafValue(main),subValue:normalizedLeafValue(sub.value)}}
/** Leerer Index ohne Conversion-Daten: jede Abfrage liefert „keine Daten“ (fail-closed in der Engine). */
export const noLeadMaturityIndex=(range:{from:string;to:string},now=new Date()):LeadMaturityIndex=>({byLeaf:{},byUrl:{},confidence:'keine Daten',p75Hours:LEAD_MATURITY_FALLBACK_HOURS,fallbackUsed:true,range:{from:range.from,to:range.to},generatedAt:now.toISOString()});
/**
 * rows: Conversions des Partners (loadAffiliateConversionsFromCache, 90 Tage). Gezählt werden nur direkte SOIs im Fenster (Berliner
 * Kalendertage); reif = Alter ≥ p75. Konfidenz = Latenzkonfidenz; liegen Conversions vor, aber keine reifen Lead→Sale-Paare, gilt
 * „niedrig“ mit Fallback 72 h. Ohne eine einzige Conversion → „keine Daten“.
 */
export function buildLeadMaturityIndex(rows:ConversionRow[],analysis:Pick<LeadLatencyAnalysis,'p75Hours'|'confidence'>,range:{from:string;to:string},now=new Date()):LeadMaturityIndex{
 if(!rows.length)return noLeadMaturityIndex(range,now);
 const{p75Hours,fallbackUsed}=effectiveP75Hours(analysis),confidence:LeadMaturityInput['confidence']=analysis.confidence==='keine Daten'?'niedrig':analysis.confidence,bounds=berlinRangeUtcBounds(range.from,range.to),fromEpoch=Date.parse(bounds.from)/1000,toEpoch=Date.parse(bounds.toExclusive)/1000,nowEpoch=now.getTime()/1000,matureBefore=nowEpoch-p75Hours*3600;
 const byLeaf:Record<string,LeadMaturityInput>={},byUrl:Record<string,LeadMaturityInput>={},bump=(bucket:Record<string,LeadMaturityInput>,key:string,mature:boolean)=>{const entry=bucket[key]||(bucket[key]={matureSois:0,totalSois:0,p75Hours,confidence});entry.totalSois++;if(mature)entry.matureSois++};
 for(const row of rows){if(!isDirectSoi(row))continue;const ts=Number(row.conversion_unix_timestamp);if(ts<fromEpoch||ts>=toEpoch)continue;const identity=conversionLeafIdentity(row),mature=ts<=matureBefore;bump(byLeaf,leafMaturityKey(identity),mature);bump(byUrl,urlMaturityKey(identity.offerId,identity.offerUrlId),mature)}
 return{byLeaf,byUrl,confidence,p75Hours,fallbackUsed,range:{from:range.from,to:range.to},generatedAt:now.toISOString()};
}
const empty=(index:LeadMaturityIndex):LeadMaturityInput=>({matureSois:0,totalSois:0,p75Hours:index.p75Hours,confidence:index.confidence});
/** Reife eines Blatts; unbekanntes Blatt → 0 von 0 mit der Index-Konfidenz (ohne Conversions „keine Daten“). */
export const leadMaturityFor=(index:LeadMaturityIndex,identity:LeadMaturityIdentity):LeadMaturityInput=>({...(index.byLeaf[leafMaturityKey(identity)]||empty(index))});
/** Reife einer Offer-URL (URL-Verdikte des Cockpits). */
export const urlLeadMaturityFor=(index:LeadMaturityIndex,offerId:string,offerUrlId:string):LeadMaturityInput=>({...(index.byUrl[urlMaturityKey(offerId,offerUrlId)]||empty(index))});
/** Summe mehrerer Blätter (Hauptquellen-Blatt über seine Unterquellen); ohne Eingaben undefined. */
export function sumLeadMaturity(items:Array<LeadMaturityInput|undefined>):LeadMaturityInput|undefined{const present=items.filter((x):x is LeadMaturityInput=>Boolean(x));if(!present.length)return undefined;const order:Record<LeadMaturityInput['confidence'],number>={'keine Daten':0,niedrig:1,mittel:2,hoch:3};return present.reduce((acc,x)=>({matureSois:acc.matureSois+x.matureSois,totalSois:acc.totalSois+x.totalSois,p75Hours:acc.p75Hours??x.p75Hours,confidence:order[x.confidence]<order[acc.confidence]?x.confidence:acc.confidence}),{matureSois:0,totalSois:0,p75Hours:null as number|null,confidence:'hoch' as LeadMaturityInput['confidence']})}

/**
 * Reife gegen die Berichtszeile: Nur junge SOIs (Alter < p75) fehlen an der Reife – sie liegen immer in den letzten Tagen und damit
 * im 90-Tage-Conversions-Fenster, egal wie lang der Berichtszeitraum ist. reif = SOIs der Berichtszeile − junge SOIs des Index-Eintrags;
 * ohne Eintrag gilt 0 junge SOIs; ohne eine einzige Conversion („keine Daten“) bleibt die Reife unbekannt (fail-closed in der Engine).
 */
const youngOf=(entry:LeadMaturityInput|undefined)=>entry?Math.max(0,entry.totalSois-entry.matureSois):0;
export function leadMaturityFromReport(index:{confidence:LeadMaturityInput['confidence'];p75Hours:number|null},entry:LeadMaturityInput|undefined,reportSois:number):LeadMaturityInput{
 const sois=Math.max(0,Math.round(Number(reportSois)||0)),p75Hours=index.p75Hours??LEAD_MATURITY_FALLBACK_HOURS;
 if(index.confidence==='keine Daten')return{matureSois:0,totalSois:sois,p75Hours,confidence:'keine Daten'};
 return{matureSois:Math.max(0,sois-youngOf(entry)),totalSois:sois,p75Hours,confidence:index.confidence};
}
/** Reife eines Blatts gegen die Berichtszeile (SourceBreakdown, Cron). */
export const leafLeadMaturityForReport=(index:LeadMaturityIndex,identity:LeadMaturityIdentity,reportSois:number)=>leadMaturityFromReport(index,index.byLeaf[leafMaturityKey(identity)],reportSois);
/** Reife einer Offer-URL gegen die Berichtszeile (URL-Verdikte des Cockpits). */
export const urlLeadMaturityForReport=(index:LeadMaturityIndex,offerId:string,offerUrlId:string,reportSois:number)=>leadMaturityFromReport(index,index.byUrl[urlMaturityKey(offerId,offerUrlId)],reportSois);
/** Persistierte Kurzfassung je Partner (Rollups-Cron, sync_state lead_maturity:v1:{affiliateId}): nur junge SOIs je Offer-URL, damit die Übersicht aller Partner ohne Conversions-Ladung gegated werden kann. */
export type LeadYoungSummary={version:1;affiliateId:string;generatedAt:string;p75Hours:number;confidence:LeadMaturityInput['confidence'];fallbackUsed:boolean;youngByUrl:Record<string,number>};
export const LEAD_MATURITY_SUMMARY_PREFIX='lead_maturity:v1:';
export const leadMaturitySummaryKey=(affiliateId:string)=>`${LEAD_MATURITY_SUMMARY_PREFIX}${affiliateId}`;
export function summarizeLeadMaturity(index:LeadMaturityIndex,affiliateId:string):LeadYoungSummary{
 const youngByUrl:Record<string,number>={};
 for(const[key,entry]of Object.entries(index.byUrl)){const young=youngOf(entry);if(young>0)youngByUrl[key]=young}
 return{version:1,affiliateId:String(affiliateId),generatedAt:index.generatedAt,p75Hours:index.p75Hours,confidence:index.confidence,fallbackUsed:index.fallbackUsed,youngByUrl};
}
const CONFIDENCES:LeadMaturityInput['confidence'][]=['hoch','mittel','niedrig','keine Daten'];
export const isLeadYoungSummary=(value:unknown):value is LeadYoungSummary=>{const s=value as LeadYoungSummary|null;return Boolean(s&&typeof s==='object'&&s.version===1&&typeof s.affiliateId==='string'&&typeof s.generatedAt==='string'&&typeof s.p75Hours==='number'&&CONFIDENCES.includes(s.confidence)&&s.youngByUrl&&typeof s.youngByUrl==='object')};
/** Reife einer Offer-URL aus der persistierten Kurzfassung gegen die Berichtszeile. */
export function urlLeadMaturityFromSummary(summary:LeadYoungSummary,offerId:string,offerUrlId:string,reportSois:number):LeadMaturityInput{
 const young=Math.max(0,Number(summary.youngByUrl[urlMaturityKey(offerId,offerUrlId)])||0);
 return leadMaturityFromReport(summary,young?{matureSois:0,totalSois:young,p75Hours:summary.p75Hours,confidence:summary.confidence}:undefined,reportSois);
}
