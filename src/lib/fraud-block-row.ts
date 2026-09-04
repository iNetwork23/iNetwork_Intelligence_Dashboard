import type{FraudSourceEvaluation}from'./fraud-control';
import{blockMarkerText,findBlockMarker,type SourceBlockMarker,type SourceBlockMarkerIndex}from'./source-block-markers';
import{isClickIdLike}from'./click-id-sub-source';
/**
 * Brücke von der Fraud-Zeile (tiefste Quelle: Pfad, source, subSource) zur Sperr-Identität, die SourceBlockButton sendet (D2).
 * Reine Funktionen, client-sicher; die Wörter der Marker kommen aus source-block-markers (STATE_WORDS).
 */
export type FraudBlockRow=Pick<FraudSourceEvaluation,'affiliateId'|'affiliateName'|'offerId'|'offerName'|'offerUrlId'|'trafficMode'|'source'|'subSource'|'sourceDimension'|'subSourceDimension'|'metrics'>;
export type FraudBlockIdentity={affiliateId:string;offerId:string;trafficMode:'tracked'|'api';level:'sub_source';mainValue:string|null;subValue:string};
export type FraudBlockState={kind:'open';identity:FraudBlockIdentity}|{kind:'blocked';identity:FraudBlockIdentity;marker:SourceBlockMarker;text:string}|{kind:'unclear';identity:FraudBlockIdentity;marker:SourceBlockMarker;text:string}|{kind:'external'};
export const FRAUD_NOT_BLOCKABLE_HINT='nur im Affiliate-Bereich sperrbar';
const PLACEHOLDERS=['N/A','Ohne Source-ID','Ohne Sub-Source','Nicht übermittelt'];
/** Gleiche Normalisierung wie normalizeSourceBlockInput (source-blocks.ts): trimmen, Platzhalter → null. */
const normalizedValue=(value:string|null|undefined)=>{if(value===undefined||value===null)return null;const text=String(value).trim();return!text||PLACEHOLDERS.includes(text)?null:text};
const positiveId=(value:string)=>/^\d+$/.test(String(value??'').trim())&&Number(value)>0;
/**
 * Vollständige Identität = gültige IDs, Pfad tracked (Smartlink/Direct → source_id/sub1) oder Clickless API (adv1/adv2) mit passenden Dimensionen
 * und einer echten Unterquelle. Das Restblatt „ohne Unterquelle“ wäre nur über die ganze Hauptquelle sperrbar – das bleibt bewusst dem Affiliate-Bereich vorbehalten (wie /sources).
 */
export function fraudRowBlockIdentity(row:Pick<FraudBlockRow,'affiliateId'|'offerId'|'trafficMode'|'source'|'subSource'|'sourceDimension'|'subSourceDimension'>):FraudBlockIdentity|null{
 if(!positiveId(row.affiliateId)||!positiveId(row.offerId))return null;
 const trafficMode=row.trafficMode==='clickless_api'?'api':row.trafficMode==='tracked_smartlink'||row.trafficMode==='tracked_direct'?'tracked':null;
 if(!trafficMode)return null;
 if(row.sourceDimension!==(trafficMode==='api'?'adv1':'source_id')||row.subSourceDimension!==(trafficMode==='api'?'adv2':'sub1'))return null;
 const subValue=normalizedValue(row.subSource);
 if(subValue===null)return null;
 // Klick-ID-artige Unterquellen kollabiert der Affiliate-Bereich (canonicalTrackedSub); eine Einzel-ID zu sperren wäre wirkungslos.
 if(trafficMode==='tracked'&&isClickIdLike(subValue))return null;
 return{affiliateId:String(row.affiliateId).trim(),offerId:String(row.offerId).trim(),trafficMode,level:'sub_source',mainValue:normalizedValue(row.source),subValue};
}
/** Sperrzustand der Zeile: aktiv/pending → gesperrt (kein Button), error → unklar (Marker plus Button für den Zweitversuch), sonst offen. */
export function fraudRowBlockState(row:Pick<FraudBlockRow,'affiliateId'|'offerId'|'trafficMode'|'source'|'subSource'|'sourceDimension'|'subSourceDimension'>,index:SourceBlockMarkerIndex|undefined):FraudBlockState{
 const identity=fraudRowBlockIdentity(row);
 if(!identity)return{kind:'external'};
 const marker=findBlockMarker(index,identity),text=marker?blockMarkerText(marker):null;
 if(!marker||!text)return{kind:'open',identity};
 return{kind:marker.status==='error'?'unclear':'blocked',identity,marker,text};
}
/** Filter „nur ungesperrte“: aktive und pending Sperren ausblenden; unklare, offene und externe Zeilen bleiben sichtbar. */
export const isFraudRowOpen=(state:FraudBlockState)=>state.kind!=='blocked';
/** Globaler Zeitraum für den Deep-Link in den Affiliate-Bereich (D5): period, bei custom mit from/to. */
export const fraudRowRangeParams=(period:string,range:{from:string;to:string})=>{const params=new URLSearchParams({period});if(period==='custom'){params.set('from',range.from);params.set('to',range.to)}return params.toString()};
