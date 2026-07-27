import 'server-only';
import {randomUUID}from'node:crypto';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {canonicalMetricRows,staleMetricIds,type ConversionCacheRow,type DailyMetricRow,type SyncState,type SyncStore} from './history-cache';
import{encodePortfolioSnapshotRow,encodeSourceSnapshotRow}from'./affiliate-source-cache';
import{newSnapshotGeneration,snapshotGenerationCreatedAt}from'./snapshot-generation';
import{buildPortfolioRangePublication,buildPortfolioRangeSnapshotRecords,stalePortfolioRangeSnapshotKeys,type PortfolioRangeSnapshotRecord}from'./portfolio-range-snapshots';

let client:SupabaseClient|null=null;
export function getSupabaseAdmin(){
  if(client)return client;
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error('SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt');
  client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  return client;
}

const throwIfError=(error:{message:string}|null,operation:string)=>{if(error)throw new Error(`Supabase ${operation}: ${error.message}`)};
async function upsertBatches(table:'conversions'|'daily_metrics',rows:ConversionCacheRow[]|DailyMetricRow[]){
  const supabase=getSupabaseAdmin();
  for(let start=0;start<rows.length;start+=500){
    const batch=rows.slice(start,start+500);
    const {error}=await supabase.from(table).upsert(batch as never[],{onConflict:'id'});
    throwIfError(error,`${table} upsert`);
  }
}
const nextDay=(day:string)=>new Date(Date.parse(`${day}T12:00:00Z`)+86_400_000).toISOString().slice(0,10);
async function existingMetricIds(from:string,to:string){const ids:string[]=[];for(let start=0;;start+=1000){const{data,error}=await getSupabaseAdmin().from('daily_metrics').select('id').gte('metric_date',from).lte('metric_date',to).order('metric_date').order('id').range(start,start+999);throwIfError(error,'daily_metrics id scan');const batch=(data||[])as{id:string}[];ids.push(...batch.map(row=>row.id));if(batch.length<1000)break}return ids}
async function zeroMetrics(ids:string[]){for(let start=0;start<ids.length;start+=200){const{error}=await getSupabaseAdmin().from('daily_metrics').update({clicks:0,sois:0,first_sales:0,rebills:0,coin_spend:0,payout:0,revenue:0,profit:0,raw:{tombstone:true}}).in('id',ids.slice(start,start+200));throwIfError(error,'stale metric tombstone')}}

async function markerGeneration(key:string){const{data,error}=await getSupabaseAdmin().from('sync_state').select('value').eq('key',key).maybeSingle();throwIfError(error,'snapshot marker read');return(data?.value as{generation?:string}|undefined)?.generation||null}
async function pruneDaySnapshots(day:string){const supabase=getSupabaseAdmin(),namespaces=[{prefix:`source_day:${day}:`,marker:`source_day_generation:${day}`},{prefix:`campaign_affiliate_day:${day}:`,marker:`campaign_affiliate_day_generation:${day}`},{prefix:`portfolio_day:${day}:`,marker:`portfolio_day_generation:${day}`}],cutoff=Date.now()-24*60*60_000;for(const{prefix,marker}of namespaces){const keys:string[]=[];for(let start=0;;start+=1000){const{data,error}=await supabase.from('sync_state').select('key').like('key',`${prefix}%`).order('key').range(start,start+999);throwIfError(error,'snapshot generation list');const batch=(data||[]).map(row=>row.key as string);keys.push(...batch);if(batch.length<1000)break}const active=await markerGeneration(marker),stale=keys.filter(key=>{const generation=key.slice(prefix.length).split(':')[0],created=snapshotGenerationCreatedAt(generation);return generation!==active&&created!==null&&created<cutoff});for(let start=0;start<stale.length;start+=200){const latest=await markerGeneration(marker),safe=stale.slice(start,start+200).filter(key=>key.slice(prefix.length).split(':')[0]!==latest);if(!safe.length)continue;const result=await supabase.from('sync_state').delete().in('key',safe);throwIfError(result.error,'stale snapshot generation delete')}}}
async function prunePortfolioRangeSnapshots(records:PortfolioRangeSnapshotRecord[]){const supabase=getSupabaseAdmin(),cutoff=Date.now()-24*60*60_000;for(const record of records){const{from,to}=record.value,prefix=`portfolio_range:${from}:${to}:`,marker=`portfolio_range_generation:${from}:${to}`,keys:string[]=[];for(let start=0;;start+=1000){const{data,error}=await supabase.from('sync_state').select('key').like('key',`${prefix}%`).order('key').range(start,start+999);throwIfError(error,'portfolio range generation list');const batch=(data||[]).map(row=>row.key as string);keys.push(...batch);if(batch.length<1000)break}const active=await markerGeneration(marker),stale=stalePortfolioRangeSnapshotKeys(keys,prefix,active||'',cutoff);for(let start=0;start<stale.length;start+=200){const latest=await markerGeneration(marker);if(!latest)continue;const safe=stalePortfolioRangeSnapshotKeys(stale.slice(start,start+200),prefix,latest,cutoff);if(!safe.length)continue;const{error}=await supabase.from('sync_state').delete().in('key',safe);throwIfError(error,'stale portfolio range delete')}}}
function campaignAffiliateRows(rows:DailyMetricRow[]){const grouped=new Map<string,{affiliate_id:string;affiliate_name:string;campaign_id:string;campaign_name:string;clicks:number;sois:number;first_sales:number;rebills:number;coin_spend:number;payout:number;revenue:number;profit:number}>();for(const row of rows){if(row.campaign_id==='0')continue;const key=`${row.affiliate_id}\u0000${row.campaign_id}`,current=grouped.get(key)||{affiliate_id:row.affiliate_id,affiliate_name:row.affiliate_name,campaign_id:row.campaign_id,campaign_name:row.campaign_name,clicks:0,sois:0,first_sales:0,rebills:0,coin_spend:0,payout:0,revenue:0,profit:0};for(const metric of['clicks','sois','first_sales','rebills','coin_spend','payout','revenue','profit']as const)current[metric]+=row[metric];grouped.set(key,current)}return Array.from(grouped.values())}
async function upsertSourceSnapshots(from:string,to:string,rows:DailyMetricRow[]){
  const byDay=new Map<string,Map<string,DailyMetricRow[]>>();
  for(const row of rows){let affiliates=byDay.get(row.metric_date);if(!affiliates){affiliates=new Map();byDay.set(row.metric_date,affiliates)}const group=affiliates.get(row.affiliate_id)||[];group.push(row);affiliates.set(row.affiliate_id,group)}
  const supabase=getSupabaseAdmin(),markers:{key:string;value:unknown}[]=[],publishedDays:string[]=[];
  for(let day=from;day<=to;day=nextDay(day)){
    await pruneDaySnapshots(day);
    const generation=newSnapshotGeneration(),affiliates=byDay.get(day)||new Map<string,DailyMetricRow[]>(),dayRows=Array.from(affiliates.values()).flat(),snapshots:{key:string;value:unknown}[]=Array.from(affiliates,([affiliateId,metrics])=>({key:`source_day:${day}:${generation}:${affiliateId}`,value:{version:2,date:day,affiliate_id:affiliateId,affiliate_name:metrics[0].affiliate_name,rows:metrics.map(encodeSourceSnapshotRow)}}));
    snapshots.push({key:`campaign_affiliate_day:${day}:${generation}`,value:{version:2,date:day,rows:campaignAffiliateRows(dayRows)}});
    snapshots.push({key:`portfolio_day:${day}:${generation}`,value:{version:2,date:day,rows:canonicalMetricRows(dayRows).map(encodePortfolioSnapshotRow)}});
    if(snapshots.length){const {error}=await supabase.from('sync_state').upsert(snapshots,{onConflict:'key'});throwIfError(error,'source snapshot upsert')}
    const marker={version:2,date:day,generation};
    markers.push({key:`source_day_generation:${day}`,value:marker},{key:`portfolio_day_generation:${day}`,value:marker},{key:`campaign_affiliate_day_generation:${day}`,value:marker});
    publishedDays.push(day);
  }
  const rangeRecords=buildPortfolioRangeSnapshotRecords(from,to,rows),rangePublication=buildPortfolioRangePublication(rangeRecords,newSnapshotGeneration());
  if(rangePublication.snapshots.length){const{error}=await supabase.from('sync_state').upsert(rangePublication.snapshots,{onConflict:'key'});throwIfError(error,'portfolio range snapshot upsert')}
  markers.push(...rangePublication.markers);
  if(markers.length){const{error}=await supabase.from('sync_state').upsert(markers,{onConflict:'key'});throwIfError(error,'snapshot generation switch')}
  await prunePortfolioRangeSnapshots(rangeRecords);
  for(const day of publishedDays)await pruneDaySnapshots(day);
}

async function acquireSyncStateLock(key:string,ttlMs:number,label:string){const supabase=getSupabaseAdmin(),owner=randomUUID(),expiresAt=new Date(Date.now()+ttlMs).toISOString();for(let attempt=0;attempt<3;attempt++){const inserted=await supabase.from('sync_state').insert({key,value:{owner,expires_at:expiresAt}});if(!inserted.error)return async()=>{const released=await supabase.from('sync_state').delete().eq('key',key).contains('value',{owner});throwIfError(released.error,`${label} release`)};if(inserted.error.code!=='23505')throw new Error(`Supabase ${label}: ${inserted.error.message}`);const current=await supabase.from('sync_state').select('value').eq('key',key).maybeSingle();throwIfError(current.error,`${label} read`);const value=current.data?.value as{owner?:string;expires_at?:string}|undefined;if(value?.owner&&value.expires_at&&Date.parse(value.expires_at)<Date.now()){const removed=await supabase.from('sync_state').delete().eq('key',key).contains('value',{owner:value.owner});throwIfError(removed.error,`expired ${label} delete`);continue}throw new Error(`Ein anderer ${label} läuft bereits`)}throw new Error(`${label} konnte nicht übernommen werden`)}
async function acquireMetricReplaceLock(){return acquireSyncStateLock('daily_metrics_replace_lock',2*60*60_000,'Reporting-Metrikersatz')}
export async function acquireHistorySyncLock(){return acquireSyncStateLock('everflow_history_sync_lock',30*60_000,'Reporting-Sync')}


export function createSupabaseSyncStore():SyncStore{
  return{
    async getState(){
      const {data,error}=await getSupabaseAdmin().from('sync_state').select('value').eq('key','everflow_history').maybeSingle();
      throwIfError(error,'sync_state read');
      return(data?.value as SyncState|undefined)||null;
    },
    async upsertConversions(rows){if(rows.length)await upsertBatches('conversions',rows)},
    async upsertMetrics(rows){if(rows.length)await upsertBatches('daily_metrics',rows)},
    async replaceMetrics(from,to,rows){
      const release=await acquireMetricReplaceLock();try{const [canonical,existing]=[canonicalMetricRows(rows),await existingMetricIds(from,to)];if(canonical.length)await upsertBatches('daily_metrics',canonical);const stale=staleMetricIds(existing,canonical);if(stale.length)await zeroMetrics(stale);await upsertSourceSnapshots(from,to,rows)}finally{await release()}
    },
    async setState(state){
      const {error}=await getSupabaseAdmin().from('sync_state').upsert({key:'everflow_history',value:state},{onConflict:'key'});
      throwIfError(error,'sync_state write');
    },
  };
}
