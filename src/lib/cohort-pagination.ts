import type{LtvCohort}from'./cohorts';
const metrics=['registrations','revenue_30d','revenue_60d','revenue_90d','revenue_180d','revenue_365d']as const;
export function paginateLtvCohorts(input:LtvCohort[],requestedPage:number,pageSize=100){
 const grouped=new Map<string,LtvCohort>();
 for(const row of input){const key=[row.registration_month,row.source_id,row.sub_source].join('\u0000'),current=grouped.get(key)||{...row,affiliate_id:'',offer_id:'',campaign_id:'',registrations:0,revenue_30d:0,revenue_60d:0,revenue_90d:0,revenue_180d:0,revenue_365d:0};for(const metric of metrics)current[metric]+=row[metric];grouped.set(key,current)}
 const all=[...grouped.values()].sort((a,b)=>b.registration_month.localeCompare(a.registration_month)||b.registrations-a.registrations||a.source_id.localeCompare(b.source_id)||a.sub_source.localeCompare(b.sub_source)),size=Math.max(1,Math.min(250,Math.floor(pageSize)||100)),pages=Math.max(1,Math.ceil(all.length/size)),page=Math.max(1,Math.min(pages,Math.floor(requestedPage)||1)),start=(page-1)*size;
 return{rows:all.slice(start,start+size),total:all.length,page,pages,pageSize:size};
}
