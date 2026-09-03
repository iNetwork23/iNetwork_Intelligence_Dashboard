import type{LtvCohort}from'./cohorts';
const metrics=['registrations','revenue_30d','revenue_60d','revenue_90d','revenue_180d','revenue_365d']as const;
export type LtvCohortFilters={affiliate?:string};
export const revenuePerRegistration=(row:Pick<LtvCohort,'registrations'|'revenue_90d'>)=>row.registrations>0?row.revenue_90d/row.registrations:null;
export function paginateLtvCohorts(input:LtvCohort[],requestedPage:number,pageSize=100,filters:LtvCohortFilters={}){
 const affiliate=(filters.affiliate||'').trim(),grouped=new Map<string,LtvCohort>();
 for(const row of input){if(affiliate&&row.affiliate_id!==affiliate)continue;const key=[row.registration_month,row.affiliate_id,row.offer_id,row.campaign_id,row.source_id,row.sub_source].join('\u0000'),current=grouped.get(key)||{...row,registrations:0,revenue_30d:0,revenue_60d:0,revenue_90d:0,revenue_180d:0,revenue_365d:0};for(const metric of metrics)current[metric]+=row[metric];grouped.set(key,current)}
 const all=[...grouped.values()].sort((a,b)=>b.registration_month.localeCompare(a.registration_month)||b.registrations-a.registrations||a.affiliate_id.localeCompare(b.affiliate_id)||a.offer_id.localeCompare(b.offer_id)||a.campaign_id.localeCompare(b.campaign_id)||a.source_id.localeCompare(b.source_id)||a.sub_source.localeCompare(b.sub_source)),size=Math.max(1,Math.min(250,Math.floor(pageSize)||100)),pages=Math.max(1,Math.ceil(all.length/size)),page=Math.max(1,Math.min(pages,Math.floor(requestedPage)||1)),start=(page-1)*size;
 return{rows:all.slice(start,start+size),total:all.length,page,pages,pageSize:size};
}
