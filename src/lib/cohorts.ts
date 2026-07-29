import 'server-only';
import {getSupabaseAdmin} from './supabase';
import{assertScopesSupported,foreignScopeRequested,type AccessMetadata}from'./rbac';

export type LtvCohort={registration_month:string;affiliate_id:string;offer_id:string;campaign_id:string;source_id:string;sub_source:string;registrations:number;revenue_30d:number;revenue_60d:number;revenue_90d:number;revenue_180d:number;revenue_365d:number};
type LtvFilters={source?:string;subSource?:string};
const INTERNAL_ROLES=new Set<AccessMetadata['role']>(['super_admin','admin','employee','read_only']);
const numeric=(row:Record<string,unknown>):LtvCohort=>({...row,registrations:Number(row.registrations||0),revenue_30d:Number(row.revenue_30d||0),revenue_60d:Number(row.revenue_60d||0),revenue_90d:Number(row.revenue_90d||0),revenue_180d:Number(row.revenue_180d||0),revenue_365d:Number(row.revenue_365d||0)}) as LtvCohort;

export async function getLtvCohorts(filters:LtvFilters,access:AccessMetadata){
 assertScopesSupported(access,['affiliate','offer','campaign','source','sub_source']);
 if(foreignScopeRequested(access,{source:filters.source,sub_source:filters.subSource}))throw new Error('403 · Fremder Datenscope');
 const supabase=getSupabaseAdmin();
 let result:{data:unknown;error:{message:string}|null};
 if(access.role==='partner'){
  result=await supabase.rpc('ltv_cohorts_scoped_v1',{
   p_affiliate_ids:access.scopes.affiliate,
   p_offer_ids:access.scopes.offer,
   p_campaign_ids:access.scopes.campaign,
   p_source_ids:access.scopes.source,
   p_sub_sources:access.scopes.sub_source,
   p_source:filters.source??null,
   p_sub_source:filters.subSource??null,
  });
 }else{
  if(!INTERNAL_ROLES.has(access.role))throw new Error('403 · Unbekannte interne Rolle');
  result=await supabase.rpc('ltv_cohorts_internal_v1',{p_source:filters.source??null,p_sub_source:filters.subSource??null});
 }
 if(result.error)throw new Error(`Supabase ltv_cohorts: ${result.error.message}`);
 return(Array.isArray(result.data)?result.data:[]).map(row=>numeric(row as Record<string,unknown>));
}

const LTV_STATE_KEY='ltv_cohorts_materialized';
async function recordLtvState(value:Record<string,unknown>){
 const {error}=await getSupabaseAdmin().from('sync_state').upsert({key:LTV_STATE_KEY,value},{onConflict:'key'});
 if(error)throw new Error(`Supabase LTV sync_state: ${error.message}`);
}
export async function refreshLtvCohorts(){
 const refreshedAt=new Date().toISOString();
 const {data,error}=await getSupabaseAdmin().rpc('refresh_ltv_cohorts_v1');
 const busy=Boolean(data&&typeof data==='object'&&'status' in data&&(data as {status?:unknown}).status==='busy');
 if(error||busy){
  const message=(error?`Supabase LTV refresh: ${error.message}`:'Supabase LTV refresh läuft bereits').slice(0,500);
  try{await recordLtvState({status:'failed',failed_at:refreshedAt,error:message})}catch(stateError){console.error('LTV refresh failure state could not be recorded',stateError)}
  throw new Error(message);
 }
 await recordLtvState({status:'ready',refreshed_at:refreshedAt,result:data});
 return data;
}
