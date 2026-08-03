import 'server-only';
import {getSupabaseAdmin} from './supabase';

export type LtvCohort={registration_month:string;source_id:string;sub_source:string;registrations:number;revenue_30d:number;revenue_60d:number;revenue_90d:number;revenue_180d:number;revenue_365d:number};
export async function getLtvCohorts(filters:{source?:string;subSource?:string}={}){
  let query=getSupabaseAdmin().from('ltv_cohorts').select('*').order('registration_month',{ascending:false}).order('source_id');
  if(filters.source)query=query.eq('source_id',filters.source);
  if(filters.subSource)query=query.eq('sub_source',filters.subSource);
  const {data,error}=await query;
  if(error)throw new Error(`Supabase ltv_cohorts: ${error.message}`);
  return(data||[]).map(row=>({
    ...row,registrations:Number(row.registrations||0),revenue_30d:Number(row.revenue_30d||0),revenue_60d:Number(row.revenue_60d||0),
    revenue_90d:Number(row.revenue_90d||0),revenue_180d:Number(row.revenue_180d||0),revenue_365d:Number(row.revenue_365d||0),
  })) as LtvCohort[];
}
