import{sourceBlockIdentityKey,type SourceBlockRecord}from'./source-blocks';
/** Client-sichere, serialisierbare Sicht auf den Sperr-Index (loadBlockIndex): identityKey → Marker. Reine Funktionen, keine Datenladung. */
export type SourceBlockMarker={id:string;status:SourceBlockRecord['status'];effectiveAt:string;affiliateId:string;offerId:string};
export type SourceBlockMarkerIndex=Record<string,SourceBlockMarker>;
/** Zeilenidentität in den Feldern, die SourceBlockButton für diese Zeile senden würde; subValue undefined/null = Hauptquellen-Ebene. */
export type SourceRowBlockIdentity={affiliateId:string;offerId:string;trafficMode:'tracked'|'api';mainValue:string|null;subValue?:string|null};
export const SOURCE_BLOCKS_HREF='/source-blocks';
const PLACEHOLDERS=['N/A','Ohne Source-ID','Ohne Sub-Source','Nicht übermittelt'];
/** Gleiche Normalisierung wie normalizeSourceBlockInput (source-blocks.ts): trimmen, Platzhalter → null. */
const normalizedValue=(value:string|null|undefined)=>{if(value===undefined||value===null)return null;const text=String(value).trim();return!text||PLACEHOLDERS.includes(text)?null:text};
const positiveId=(value:string)=>{const text=String(value??'').trim();return/^\d+$/.test(text)&&Number(text)>0?Number(text):null};
export function sourceBlockMarkerIndex(index:Map<string,SourceBlockRecord>|Iterable<[string,SourceBlockRecord]>):SourceBlockMarkerIndex{
 const markers:SourceBlockMarkerIndex={};
 for(const[key,record]of index)markers[key]={id:record.id,status:record.status,effectiveAt:record.effectiveAt,affiliateId:String(record.affiliateId),offerId:String(record.offerId)};
 return markers;
}
/** Schlüssel der Zeile im Sperr-Index, eigene Ebene zuerst: [Unterquelle, Hauptquelle] bzw. [Hauptquelle]. Leer bei ungültigen IDs. */
export function sourceRowBlockKeys(row:SourceRowBlockIdentity):string[]{
 const affiliateId=positiveId(row.affiliateId),offerId=positiveId(row.offerId);
 if(affiliateId===null||offerId===null)return[];
 const mainField=row.trafficMode==='api'?'adv1':'source_id',subField=row.trafficMode==='api'?'adv2':'sub1',mainValue=normalizedValue(row.mainValue),subValue=normalizedValue(row.subValue),base={affiliateId,offerId,trafficMode:row.trafficMode,mainField,mainValue,subField} as const;
 const keys=[sourceBlockIdentityKey({...base,level:'main_source',subValue:null})];
 if(subValue!==null)keys.unshift(sourceBlockIdentityKey({...base,level:'sub_source',subValue}));
 return keys;
}
/** Erster nicht-inaktiver Marker für die Zeile; eine Hauptquellen-Sperre deckt ihre Unterquellen ab. */
export function findBlockMarker(index:SourceBlockMarkerIndex|undefined,row:SourceRowBlockIdentity):SourceBlockMarker|null{
 if(!index)return null;
 for(const key of sourceRowBlockKeys(row)){const marker=index[key];if(marker&&marker.status!=='inactive')return marker}
 return null;
}
const berlinDate=(iso:string)=>new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Berlin'}).format(new Date(iso));
/** Anzeigetext: aktiv → „Gesperrt seit <Datum>“, error/pending → „Sperre unklar“, inaktiv → null (kein Marker). */
export function blockMarkerText(marker:SourceBlockMarker):string|null{
 if(marker.status==='active')return`Gesperrt seit ${berlinDate(marker.effectiveAt)}`;
 if(marker.status==='error'||marker.status==='pending')return'Sperre unklar';
 return null;
}
export const isBlockedMarker=(marker:SourceBlockMarker|null)=>marker?.status==='active';
/** Handlungs-Kandidaten ohne aktiv gesperrte Einheiten; unklare Sperren bleiben sichtbar (mit Marker). */
export function partitionBlockedCandidates<T extends SourceRowBlockIdentity>(items:T[],index:SourceBlockMarkerIndex|undefined):{visible:T[];hidden:T[]}{
 if(!index)return{visible:items,hidden:[]};
 const visible:T[]=[],hidden:T[]=[];
 for(const item of items)(isBlockedMarker(findBlockMarker(index,item))?hidden:visible).push(item);
 return{visible,hidden};
}
/** Aktive Sperren je Affiliate und Offer (für LP-/Cockpit-Zeilen ohne Quellenidentität). */
export function countActiveBlocks(index:SourceBlockMarkerIndex|undefined,affiliateId:string,offerId:string):number{
 if(!index)return 0;
 let count=0;
 for(const marker of Object.values(index))if(marker.status==='active'&&marker.affiliateId===String(affiliateId)&&marker.offerId===String(offerId))count++;
 return count;
}
export const hiddenBlockedText=(count:number)=>`${count} gesperrte ${count===1?'Quelle':'Quellen'} ausgeblendet`;
export const activeBlocksText=(count:number)=>`${count} ${count===1?'Quelle':'Quellen'} gesperrt`;
