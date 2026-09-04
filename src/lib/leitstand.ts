import{unstable_cache}from'next/cache';
import{loadSourceCandidates,type SourceCandidate,type SourceCandidatesSnapshot}from'./source-candidates';
import{loadBlockIndex}from'./block-effects';
import{sourceCandidateBlockKey,sourceCandidateHref,sourceCandidateBlockKeys,isBlockableCandidate}from'./source-candidate-link';
import{sourceBlockLabel,type SourceBlockRecord}from'./source-blocks';
import{reportingRange}from'./supabase-reporting';
import{can,parseAccessMetadata,type AccessMetadata}from'./rbac';

/** Leitstand (Startseite, D6/Prinzip A): reine Ableitungen aus dem Quellen-Rollup und dem Sperr-Index, dazu die Ladefunktionen. Kein Everflow-Zugriff, keine Schreibzugriffe. */
export const LEITSTAND_TOP_N=3;
export const LEITSTAND_RANGE='30d' as const;
export const LEITSTAND_COUNTERS_REVALIDATE_SECONDS=90;
export const LEITSTAND_ROLLUP_PENDING='Quellen-Rollup steht noch aus (läuft stündlich um :47)';
export type LeitstandBlockState='none'|'active'|'pending'|'error'|'inactive';
export type LeitstandRow={key:string;href:string;title:string;affiliate:string;offer:string;source:string;action:SourceCandidate['action'];severity:SourceCandidate['severity'];reason:string;profit:number;sois:number;clicks:number;leadStatus:string|null;block:{state:LeitstandBlockState;since:string|null;id:string|null};blockable:boolean};
export type LeitstandCounters={openKill:number;activeBlocks:number;incidents:number};
export type LeitstandModel={range:{from:string;to:string};generatedAt:string;affiliates:number;affiliatesProcessed:number;coverageComplete:boolean;losses:LeitstandRow[];winners:LeitstandRow[];counters:LeitstandCounters};
export type LeitstandView={model:LeitstandModel|null;failed:boolean;blockIndexUnavailable:boolean};
type BlockIndex=Map<string,SourceBlockRecord>;
const RUNNING:ReadonlySet<SourceBlockRecord['status']>=new Set(['active','pending','error']);
const euro=new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}),integer=new Intl.NumberFormat('de-DE');
const berlinDate=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric'}),berlinDateTime=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const identity=(row:SourceCandidate)=>`${row.affiliateId}|${row.offerId}|${row.offerUrlId}|${row.trafficMode}|${row.level}|${row.mainValue??''}|${row.subValue??''}`;
const byLoss=(a:SourceCandidate,b:SourceCandidate)=>a.profit-b.profit||b.sois-a.sois||identity(a).localeCompare(identity(b));
const byGain=(a:SourceCandidate,b:SourceCandidate)=>b.profit-a.profit||b.sois-a.sois||identity(a).localeCompare(identity(b));
/** Erster nicht-inaktiver Record über eigene Ebene und Hauptquelle (eine Hauptquellen-Sperre deckt Unterquellen ab). */
const blockOf=(row:SourceCandidate,index:BlockIndex)=>{let inactive:SourceBlockRecord|undefined;for(const key of sourceCandidateBlockKeys(row)){const record=index.get(key);if(!record)continue;if(record.status!=='inactive')return record;inactive??=record}return inactive};
const isOpenKill=(row:SourceCandidate,index:BlockIndex)=>row.action==='AUSSCHALTEN'&&isBlockableCandidate(row)&&!RUNNING.has(blockOf(row,index)?.status as SourceBlockRecord['status']);
/** Top-N Verlustquellen: nur AUSSCHALTEN-Kandidaten, Profit aufsteigend (größter Verlust zuerst). */
export const rankLosses=(rows:SourceCandidate[],limit=LEITSTAND_TOP_N)=>rows.filter(row=>row.action==='AUSSCHALTEN').sort(byLoss).slice(0,limit);
/** Top-N Skalierungskandidaten: nur SKALIEREN, Profit absteigend. */
export const rankWinners=(rows:SourceCandidate[],limit=LEITSTAND_TOP_N)=>rows.filter(row=>row.action==='SKALIEREN').sort(byGain).slice(0,limit);
/** Zeile mit Sperrstatus aus dem Sperr-Index (Identität über sourceCandidateBlockKey) und Deep-Link auf /sources. */
export function leitstandRow(row:SourceCandidate,index:BlockIndex):LeitstandRow{
 const record=blockOf(row,index),state:LeitstandBlockState=record?record.status:'none';
 return{key:sourceCandidateBlockKey(row),href:sourceCandidateHref(row,LEITSTAND_RANGE),title:`${row.affiliate} · ${row.offer}`,affiliate:row.affiliate,offer:row.offer,source:sourceBlockLabel(row),action:row.action,severity:row.severity,reason:row.reason,profit:row.profit,sois:row.sois,clicks:row.clicks,leadStatus:row.leadStatus,block:{state,since:state==='active'?record!.effectiveAt:null,id:record?.id??null},blockable:isBlockableCandidate(row)};
}
/** Laufende Eingriffe: offene AUSSCHALTEN-Kandidaten (ohne aktive/laufende Sperre), aktive Sperren, Sperr-Incidents (pending/error). */
export function countLeitstand(rows:SourceCandidate[],index:BlockIndex):LeitstandCounters{
 let activeBlocks=0,incidents=0;for(const record of index.values()){if(record.status==='active')activeBlocks++;else if(record.status==='pending'||record.status==='error')incidents++}
 return{openKill:rows.filter(row=>isOpenKill(row,index)).length,activeBlocks,incidents};
}
export function buildLeitstand(snapshot:SourceCandidatesSnapshot|null,index:BlockIndex,limit=LEITSTAND_TOP_N):LeitstandModel|null{
 if(!snapshot)return null;
 return{range:snapshot.range,generatedAt:snapshot.generatedAt,affiliates:snapshot.affiliates,affiliatesProcessed:snapshot.affiliatesProcessed,coverageComplete:snapshot.coverageComplete,losses:rankLosses(snapshot.rows,limit).map(row=>leitstandRow(row,index)),winners:rankWinners(snapshot.rows,limit).map(row=>leitstandRow(row,index)),counters:countLeitstand(snapshot.rows,index)};
}
/** Geldwert nur mit finance.view, sonst Volumen (SOIs · Klicks). */
export const leitstandAmount=(row:Pick<LeitstandRow,'profit'|'sois'|'clicks'>,finance:boolean)=>finance?euro.format(row.profit):`${integer.format(row.sois)} SOIs · ${integer.format(row.clicks)} Klicks`;
export const formatBlockSince=(effectiveAt:string)=>`Gesperrt seit ${berlinDate.format(new Date(effectiveAt))}`;
/** Datenherkunft: Rollup-Zeit und Abdeckung; Warnung, wenn der Cron nicht alle Partner geschafft hat. */
export function describeRollup(model:Pick<LeitstandModel,'generatedAt'|'affiliates'|'affiliatesProcessed'|'coverageComplete'>):{source:string;warning:string|null}{
 const time=Number.isFinite(Date.parse(model.generatedAt))?berlinDateTime.format(new Date(model.generatedAt)):'unbekannt';
 return{source:`Rollup vom ${time} · ${model.affiliatesProcessed} von ${model.affiliates} Partnern`,warning:model.coverageComplete?null:`Rollup unvollständig: ${model.affiliatesProcessed} von ${model.affiliates} Partnern ausgewertet – Zeitbudget erreicht oder Partner übersprungen.`};
}
/** Cron-Ausfall sichtbar (Abnahme H): Rollup älter als zwei Stunden → Warnung; null, wenn frisch oder Zeit unlesbar. */
export const ROLLUP_STALE_AFTER_MS=2*60*60_000;
export function rollupStaleWarning(generatedAt:string,now=new Date()):string|null{const at=Date.parse(generatedAt);if(!Number.isFinite(at))return null;const age=now.getTime()-at;if(age<=ROLLUP_STALE_AFTER_MS)return null;const hours=Math.floor(age/3_600_000);return`Rollup ist ${hours} Stunden alt – der Rollups-Cron (stündlich um :47) hat seitdem nicht geschrieben.`}
/** D7: Partner sehen nichts vom Leitstand; interne Rollen brauchen dashboard.view. */
export const mayViewLeitstand=(access:AccessMetadata)=>access.role!=='partner'&&can(access,'dashboard.view');
/** Sperr-Aktionen wie /source-blocks: landingpages.manage UND api.manage. */
export const mayBlockSources=(access:AccessMetadata)=>access.role!=='partner'&&can(access,'landingpages.manage')&&can(access,'api.manage');
/** Berichtszeitraum des Leitstands (30 Tage, Berlin); reportingRange liefert für '30d' immer ein from. */
export const leitstandRange=(now=new Date())=>{const range=reportingRange(LEITSTAND_RANGE,now);return{from:range.from??range.to,to:range.to}};
/** Lädt Rollup und Sperr-Index für die letzten 30 Tage; wirft nie – ohne Snapshot bleibt model null, ohne Sperr-Index bleiben die Zeilen ohne Sperrstatus. */
export async function loadLeitstand(access:AccessMetadata,now=new Date()):Promise<LeitstandView>{
 const range=leitstandRange(now);
 let snapshot:SourceCandidatesSnapshot|null=null,index:BlockIndex=new Map(),failed=false,blockIndexUnavailable=false;
 const[snapshotResult,indexResult]=await Promise.allSettled([loadSourceCandidates(range,access),loadBlockIndex()]);
 if(snapshotResult.status==='fulfilled')snapshot=snapshotResult.value;else{failed=true;console.error('Leitstand: Quellen-Rollup nicht lesbar',snapshotResult.reason)}
 if(indexResult.status==='fulfilled')index=indexResult.value;else if(snapshot){blockIndexUnavailable=true;console.error('Leitstand: Sperr-Index nicht lesbar',indexResult.reason)}
 return{model:buildLeitstand(snapshot,index),failed,blockIndexUnavailable};
}
/** Accountweiter Lesezugriff für den gebündelten Zähler (kein Partner-Scope); erst beim ersten Aufruf gebildet. */
let internalAccess:AccessMetadata|null=null;
const systemAccess=()=>internalAccess??=parseAccessMetadata({role:'admin',status:'active',grants:[],denials:[],version:0,scopes:{}});
/** Shell-Zähler (Sidebar-Badges): accountweit, einmal je 90 s über beide Tags gebündelt; Aufrufer gated auf interne Rollen mit dashboard.view. */
export async function loadLeitstandCounters(now=new Date()):Promise<LeitstandCounters>{
 const range=leitstandRange(now);
 return unstable_cache(async()=>{const[snapshot,index]=await Promise.all([loadSourceCandidates(range,systemAccess()),loadBlockIndex()]);return countLeitstand(snapshot?.rows??[],index)},['leitstand-counters-v1',range.from,range.to],{revalidate:LEITSTAND_COUNTERS_REVALIDATE_SECONDS,tags:['source-candidates','source-blocks']})();
}
