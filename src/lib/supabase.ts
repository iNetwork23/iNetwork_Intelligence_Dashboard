import 'server-only';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import type {ConversionCacheRow,DailyMetricRow,HourlyMetricRow,SyncState,SyncStore} from './history-cache';
import type {CohortClient} from './cohorts';

let client:SupabaseClient|null=null;
export function getSupabaseAdmin(){
  if(client)return client;
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error('SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt');
  client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  return client;
}

// Die Query-Builder-Generics von supabase-js sind zu tief für strukturelles Matching,
// daher wird der Client hier einmalig auf die schmale Kohorten-Schnittstelle reduziert.
export const getCohortClient=()=>getSupabaseAdmin() as unknown as CohortClient;

const throwIfError=(error:{message:string}|null,operation:string)=>{if(error)throw new Error(`Supabase ${operation}: ${error.message}`)};
async function upsertBatches(table:'conversions'|'daily_metrics'|'hourly_metrics',rows:ConversionCacheRow[]|DailyMetricRow[]|HourlyMetricRow[]){
  const supabase=getSupabaseAdmin();
  for(let start=0;start<rows.length;start+=100){
    const batch=rows.slice(start,start+100);
    const {error}=await supabase.from(table).upsert(batch as never[],{onConflict:'id'});
    throwIfError(error,`${table} upsert`);
  }
}

export function createSupabaseSyncStore():SyncStore{
  return{
    async getState(){
      const {data,error}=await getSupabaseAdmin().from('sync_state').select('value').eq('key','everflow_history').maybeSingle();
      throwIfError(error,'sync_state read');
      return(data?.value as SyncState|undefined)||null;
    },
    async upsertConversions(rows){if(rows.length)await upsertBatches('conversions',rows)},
    async upsertMetrics(rows){if(rows.length)await upsertBatches('daily_metrics',rows)},
    async upsertHourlyMetrics(rows){if(rows.length)await upsertBatches('hourly_metrics',rows)},
    async pruneHourlyMetrics(before){
      const {error}=await getSupabaseAdmin().rpc('prune_hourly_metrics',{p_before:before});
      throwIfError(error,'prune_hourly_metrics');
    },
    async setState(state){
      const {error}=await getSupabaseAdmin().from('sync_state').upsert({key:'everflow_history',value:state},{onConflict:'key'});
      throwIfError(error,'sync_state write');
    },
  };
}
