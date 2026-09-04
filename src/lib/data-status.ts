import {unstable_cache} from 'next/cache';
import {getSupabaseAdmin} from './supabase';
import type {SyncPhase,SyncState} from './history-cache';

export const BACKFILL_TOTAL_DAYS=365;
export const STALE_AFTER_MINUTES=90;
export type DataStatusLevel='ok'|'stale'|'unknown';
export type LtvSyncState={status?:string|null;refreshed_at?:string|null;failed_at?:string|null;error?:string|null};
export type FraudSyncState={phase?:string|null;readyAt?:string|null};
export type DataStatus={syncAt:string|null;syncAgeMinutes:number|null;phase:SyncPhase|null;backfillDone:number|null;backfillTotal:365;todayPartial:boolean;ltv:{refreshedAt:string|null;failed:boolean};fraudCutoverReady:boolean;level:DataStatusLevel};
export type HeaderStatus={label:string;tone:'live'|'warning'|'neutral'};
type SyncStates={history:SyncState|null;ltv:LtvSyncState|null;fraud:FraudSyncState|null};

const SYNC_KEYS={history:'everflow_history',ltv:'ltv_cohorts_materialized',fraud:'fraud_conversion_backfill_v3'} as const;
const DAY=86_400_000;
const berlinDay=(value:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
const dayIndex=(day:string)=>Math.round(Date.parse(`${day}T00:00:00Z`)/DAY);
const parseTime=(value:string|null|undefined)=>{const time=value?Date.parse(value):NaN;return Number.isFinite(time)?time:null};

export function formatBerlinTime(value:string|null){const time=parseTime(value);return time===null?'–':new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(new Date(time))}
export function formatSyncAge(minutes:number){return minutes>=60?`${Math.round(minutes/60)} h`:`${minutes} min`}

export function deriveDataStatus(state:SyncState|null,now:Date,extra:{ltv?:LtvSyncState|null;fraud?:FraudSyncState|null}={}):DataStatus{
  const syncTime=parseTime(state?.last_success_at),syncAt=syncTime===null?null:state!.last_success_at,syncAgeMinutes=syncTime===null?null:Math.max(0,Math.round((now.getTime()-syncTime)/60_000)),phase=state?.phase??null;
  const startIndex=state?dayIndex(state.backfill_start):NaN,endIndex=state?dayIndex(state.next_end):NaN;
  const backfillDone=phase==='rolling'?BACKFILL_TOTAL_DAYS:phase==='backfill'&&Number.isFinite(startIndex)&&Number.isFinite(endIndex)?Math.min(BACKFILL_TOTAL_DAYS,Math.max(0,BACKFILL_TOTAL_DAYS-1-(endIndex-startIndex))):null;
  const todayPartial=phase==='rolling'&&syncTime!==null&&berlinDay(new Date(syncTime))===berlinDay(now);
  const ltv=extra.ltv||null,ltvRefreshedAt=ltv?.status!=='failed'&&parseTime(ltv?.refreshed_at)!==null?ltv!.refreshed_at!:null,fraud=extra.fraud||null;
  const level:DataStatusLevel=!state||syncAgeMinutes===null?'unknown':syncAgeMinutes>STALE_AFTER_MINUTES?'stale':'ok';
  return{syncAt,syncAgeMinutes,phase,backfillDone,backfillTotal:BACKFILL_TOTAL_DAYS,todayPartial,ltv:{refreshedAt:ltvRefreshedAt,failed:ltv?.status==='failed'},fraudCutoverReady:fraud?.phase==='rolling'&&parseTime(fraud.readyAt)!==null,level};
}

export function headerStatus(status:DataStatus):HeaderStatus{
  if(status.level==='unknown')return{label:'Sync unbekannt',tone:'warning'};
  if(status.level==='stale')return{label:`Sync vor ${formatSyncAge(status.syncAgeMinutes??0)}`,tone:'warning'};
  if(status.phase==='backfill')return{label:`Backfill ${status.backfillDone??0}/${status.backfillTotal}`,tone:'neutral'};
  return{label:`Sync ${formatBerlinTime(status.syncAt)}`,tone:'live'};
}

export function partnerHeaderStatus(status:DataStatus):HeaderStatus{return{label:status.syncAt?`Stand ${formatBerlinTime(status.syncAt)}`:'Stand unbekannt',tone:'neutral'}}

export function ltvHeaderStatus(status:DataStatus):HeaderStatus{
  if(status.ltv.failed)return{label:'LTV-Refresh fehlgeschlagen',tone:'warning'};
  return status.ltv.refreshedAt?{label:`LTV ${formatBerlinTime(status.ltv.refreshedAt)}`,tone:'live'}:{label:'LTV unbekannt',tone:'warning'};
}

export function describeDataStatus(status:DataStatus):{primary:string;ltv:string|null}{
  const ltv=status.ltv.failed?'LTV-Refresh fehlgeschlagen':status.ltv.refreshedAt?`LTV-Kohorten ${formatBerlinTime(status.ltv.refreshedAt)}`:null;
  if(status.level==='unknown')return{primary:'Sync-Status nicht lesbar',ltv};
  if(status.level==='stale')return{primary:`Letzter erfolgreicher Sync vor ${formatSyncAge(status.syncAgeMinutes??0)} – Zahlen können veraltet sein`,ltv};
  if(status.phase==='backfill')return{primary:`Backfill ${status.backfillDone??0}/${status.backfillTotal} Tage · heute alle 6 h`,ltv};
  const time=formatBerlinTime(status.syncAt);
  return{primary:`Everflow-Sync ${time} · vor ${status.syncAgeMinutes} min${status.todayPartial?` · heute Teiltag bis ${time}`:''}`,ltv};
}

async function loadSyncStates():Promise<SyncStates>{
  const {data,error}=await getSupabaseAdmin().from('sync_state').select('key,value').in('key',[SYNC_KEYS.history,SYNC_KEYS.ltv,SYNC_KEYS.fraud]);
  if(error)throw new Error(`Supabase sync_state read: ${error.message}`);
  const byKey=new Map(((data||[]) as {key:string;value:unknown}[]).map(row=>[row.key,row.value]));
  return{history:(byKey.get(SYNC_KEYS.history) as SyncState|undefined)||null,ltv:(byKey.get(SYNC_KEYS.ltv) as LtvSyncState|undefined)||null,fraud:(byKey.get(SYNC_KEYS.fraud) as FraudSyncState|undefined)||null};
}
const cachedSyncStates=unstable_cache(loadSyncStates,['data-status-v1'],{revalidate:60,tags:['data-status']});

export async function getDataStatus():Promise<DataStatus>{
  try{const states=await cachedSyncStates();return deriveDataStatus(states.history,new Date(),{ltv:states.ltv,fraud:states.fraud})}
  catch(error){console.error('Data status unavailable',error);return deriveDataStatus(null,new Date())}
}
