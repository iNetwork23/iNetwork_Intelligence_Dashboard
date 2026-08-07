import type{SmartlinkSourceFact}from'./smartlink-transparency';

export type CanonicalSourceConversion={
 type:'soi'|'coin_spend'|'first_sale'|'rebill';converted_at:string;offer_url_id:string|null;offer_id:string|null;offer_name:string|null;campaign_id?:string|null;
 source_id?:string|null;sub_source?:string|null;revenue:number|string;payout:number|string;status:string|null;is_scrub:boolean|null;raw?:Record<string,unknown>|null;
};
const number=(value:unknown)=>Number.isFinite(Number(value))?Number(value):0;
const clean=(value:unknown)=>{const text=String(value??'').trim();return!text||text.toUpperCase()==='N/A'?'':text};
const berlinDay=(value:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const key=(row:Pick<SmartlinkSourceFact,'metric_date'|'offer_url_id'|'offer_id'|'source_id'|'sub_source'>)=>JSON.stringify([row.metric_date||'',row.offer_url_id,row.offer_id,row.source_id,row.sub_source]);
const blankMetrics=()=>({clicks:0,sois:0,first_sales:0,rebills:0,coin_spend:0,payout:0,revenue:0,profit:0});

export function mergeCanonicalSourceConversions(snapshotFacts:SmartlinkSourceFact[],conversions:CanonicalSourceConversion[],acceptedDays:Set<string>){
 if(!acceptedDays.size)return snapshotFacts;
 const grouped=new Map<string,SmartlinkSourceFact>();
 const add=(fact:SmartlinkSourceFact)=>{const id=key(fact),current=grouped.get(id)||{...fact,...blankMetrics()};for(const metric of['clicks','sois','first_sales','rebills','coin_spend','payout','revenue','profit']as const)current[metric]=number(current[metric])+number(fact[metric]);grouped.set(id,current)};
 for(const fact of snapshotFacts){if(!fact.metric_date||!acceptedDays.has(fact.metric_date)){add(fact);continue}add({...fact,sois:0,first_sales:0,rebills:0,coin_spend:0,payout:0,revenue:0,profit:0})}
 for(const row of conversions){const day=berlinDay(row.converted_at),approved=!row.status||row.status.toLowerCase()==='approved';if(!acceptedDays.has(day)||row.is_scrub||!approved)continue;const raw=row.raw||{},source=clean(raw.source_id)||clean(row.source_id),sub=['sub5','sub4','sub3','sub2','sub1'].map(dimension=>clean(raw[dimension])).find(Boolean)||clean(row.sub_source),revenue=number(row.revenue),payout=number(row.payout),fact:SmartlinkSourceFact={metric_date:day,offer_url_id:clean(row.offer_url_id)||'0',offer_id:clean(row.offer_id)||'0',offer_name:clean(row.offer_name)||`Offer #${clean(row.offer_id)||'0'}`,source_id:source,sub_source:sub,...blankMetrics(),revenue,payout,profit:revenue-payout,raw:{traffic_mode:'tracked'}};if(row.type==='soi')fact.sois=1;else if(row.type==='first_sale')fact.first_sales=1;else if(row.type==='rebill')fact.rebills=1;else fact.coin_spend=1;add(fact)}
 return[...grouped.values()].filter(row=>(['clicks','sois','first_sales','rebills','coin_spend','payout','revenue','profit']as const).some(metric=>number(row[metric])!==0));
}
