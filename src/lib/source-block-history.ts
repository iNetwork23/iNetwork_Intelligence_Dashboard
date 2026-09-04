import type {SecurityStore} from './security';
import {securityStore} from './access-store';
import {isSourceBlockReasonCategory,type SourceBlockReasonCategory} from './source-block-reasons';
export {SOURCE_BLOCK_REASON_LABELS,SOURCE_BLOCK_REASON_CATEGORIES,isSourceBlockReasonCategory,type SourceBlockReasonCategory} from './source-block-reasons';
export type SourceBlockHistoryAction='activate'|'activate_across_offers'|'deactivate'|'activate_failed'|'deactivate_failed'|'reconcile_ok'|'reconcile_mismatch';
export type SourceBlockHistoryEvent={id:string;blockId:string;identityKey:string;at:string;actorId:string;action:SourceBlockHistoryAction;reasonCategory?:SourceBlockReasonCategory;reason?:string;before?:unknown;after?:unknown;error?:string};
export const SOURCE_BLOCK_HISTORY_PREFIX='source_block_history:';
export const SOURCE_BLOCK_HISTORY_LIMIT=500;
const ACTIONS:SourceBlockHistoryAction[]=['activate','activate_across_offers','deactivate','activate_failed','deactivate_failed','reconcile_ok','reconcile_mismatch'];
const text=(value:unknown,max:number)=>String(value??'').trim().slice(0,max);
const blockSegment=(blockId:string)=>text(blockId,200).replace(/\s+/g,'_')||'unbekannt';
export const sourceBlockHistoryKey=(event:Pick<SourceBlockHistoryEvent,'blockId'|'at'|'id'>)=>`${SOURCE_BLOCK_HISTORY_PREFIX}${blockSegment(event.blockId)}:${event.at}:${event.id}`;
const isEvent=(value:unknown):value is SourceBlockHistoryEvent=>Boolean(value)&&typeof value==='object'&&typeof(value as SourceBlockHistoryEvent).id==='string'&&typeof(value as SourceBlockHistoryEvent).at==='string'&&typeof(value as SourceBlockHistoryEvent).blockId==='string'&&ACTIONS.includes((value as SourceBlockHistoryEvent).action);
/** Append-only: schreibt genau einen neuen Key je Ereignis, überschreibt nie und wirft nie (Fehler werden nur geloggt). */
/** `at` darf der Aufrufer setzen (z. B. die Uhr des Abgleichs); sonst gilt die Schreibzeit. */
export async function recordSourceBlockHistory(event:Omit<SourceBlockHistoryEvent,'id'|'at'>&{at?:string},store?:SecurityStore):Promise<void>{
 try{
  if(!ACTIONS.includes(event.action))throw new Error(`Unbekannte Historie-Aktion: ${String(event.action)}`);
  const record:SourceBlockHistoryEvent={...event,blockId:blockSegment(event.blockId),identityKey:text(event.identityKey,400),actorId:text(event.actorId,200),id:crypto.randomUUID(),at:typeof event.at==='string'&&Number.isFinite(Date.parse(event.at))?new Date(event.at).toISOString():new Date().toISOString()};
  if(record.reasonCategory!==undefined&&!isSourceBlockReasonCategory(record.reasonCategory))delete record.reasonCategory;
  if(record.reason!==undefined)record.reason=text(record.reason,500);
  if(record.error!==undefined)record.error=text(record.error,1000);
  const target=store??securityStore(),key=sourceBlockHistoryKey(record);
  if(!(await target.setIfAbsent(key,record)))throw new Error(`Historie-Key existiert bereits: ${key}`);
 }catch(error){console.error('Source block history could not be recorded',error)}
}
/** Neueste zuerst, maximal SOURCE_BLOCK_HISTORY_LIMIT Ereignisse; ohne blockId die gesamte Historie. */
export async function listSourceBlockHistory(blockId?:string,store?:SecurityStore):Promise<SourceBlockHistoryEvent[]>{
 const prefix=blockId?`${SOURCE_BLOCK_HISTORY_PREFIX}${blockSegment(blockId)}:`:SOURCE_BLOCK_HISTORY_PREFIX;
 return(await(store??securityStore()).list(prefix)).map(item=>item.value).filter(isEvent).sort((a,b)=>b.at.localeCompare(a.at)||b.id.localeCompare(a.id)).slice(0,SOURCE_BLOCK_HISTORY_LIMIT);
}
