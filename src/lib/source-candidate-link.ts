import{sourceBlockIdentityKey}from'./source-blocks';
/** Gemeinsamer Vertrag für Deep-Links und Sperr-Zuordnung von Quell-Kandidaten (Leitstand → /sources → Sperr-Index). Client-sicher. */
export type SourceCandidateRange='7d'|'30d';
export const SOURCE_CANDIDATE_RANGES:SourceCandidateRange[]=['7d','30d'];
export const isSourceCandidateRange=(value:unknown):value is SourceCandidateRange=>value==='7d'||value==='30d';
export type SourceCandidateIdentity={affiliateId:string;offerId:string;offerUrlId:string;trafficMode:'tracked'|'api';level:'main_source'|'sub_source';mainValue:string|null;subValue:string|null};
const enc=(value:string|null)=>encodeURIComponent(value??'');
/** Stabiler Schlüssel einer Kandidaten-Zeile (Affiliate|Offer|Offer-URL|Modus|Ebene|Haupt|Unter), URL-tauglich. */
export const sourceCandidateKey=(row:SourceCandidateIdentity)=>[row.affiliateId,row.offerId,row.offerUrlId,row.trafficMode,row.level,row.mainValue,row.subValue].map(value=>enc(value===null?null:String(value))).join('|');
export function parseSourceCandidateKey(key:string):SourceCandidateIdentity|null{if(typeof key!=='string'||key.length>600)return null;const parts=key.split('|');if(parts.length!==7)return null;let decoded:string[];try{decoded=parts.map(part=>decodeURIComponent(part))}catch{return null}const[affiliateId,offerId,offerUrlId,trafficMode,level,mainValue,subValue]=decoded;if(!/^\d+$/.test(affiliateId)||!/^\d+$/.test(offerId)||!/^\d+$/.test(offerUrlId))return null;if(trafficMode!=='tracked'&&trafficMode!=='api')return null;if(level!=='main_source'&&level!=='sub_source')return null;return{affiliateId,offerId,offerUrlId,trafficMode,level,mainValue:mainValue===''?null:mainValue,subValue:subValue===''?null:subValue}}
/** DOM-Id der Zeile auf /sources (nur [A-Za-z0-9_-]). */
export const sourceCandidateDomId=(row:SourceCandidateIdentity)=>'sc-'+sourceCandidateKey(row).replace(/[^A-Za-z0-9_-]/g,char=>'_'+char.charCodeAt(0).toString(16));
/** Deep-Link auf die Zeile in der partnerübergreifenden Quellenliste. */
export const sourceCandidateHref=(row:SourceCandidateIdentity,range:SourceCandidateRange='30d')=>`/sources?range=${range}&open=${encodeURIComponent(sourceCandidateKey(row))}`;
/** Identität für den Sperr-Index (sourceBlockIdentityKey): Feldnamen folgen dem Traffic-Modus wie in SourceBreakdown. */
export const sourceCandidateBlockIdentity=(row:SourceCandidateIdentity)=>({affiliateId:Number(row.affiliateId),offerId:Number(row.offerId),trafficMode:row.trafficMode,level:row.level,mainField:(row.trafficMode==='api'?'adv1':'source_id') as 'adv1'|'source_id',mainValue:row.mainValue,subField:(row.trafficMode==='api'?'adv2':'sub1') as 'adv2'|'sub1',subValue:row.subValue});
export const sourceCandidateBlockKey=(row:SourceCandidateIdentity)=>sourceBlockIdentityKey(sourceCandidateBlockIdentity(row));
