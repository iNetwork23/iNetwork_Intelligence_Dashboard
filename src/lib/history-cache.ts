export type SyncPhase='backfill'|'rolling';
export type SyncState={phase:SyncPhase;backfill_start:string;next_end:string;last_success_at:string|null};
export type SyncWindow={mode:SyncPhase;from:string;to:string};
export type ReportRow={columns:{column_type:string;id:string;label:string}[];reporting:Record<string,number>};
import{isApiOffer}from'./affiliate-source-dimensions';

export type EverflowConversion={
  conversion_id?:string;transaction_id:string;conversion_unix_timestamp:number;is_event:boolean;event:string;status?:string;
  payout?:number;revenue?:number;cost?:number;source_id?:string;sub1?:string;is_scrub?:boolean;
  relationship?:{
    affiliate?:{network_affiliate_id:number;name?:string};offer?:{network_offer_id:number;name?:string};
    offer_url?:{network_offer_url_id:number;name?:string};campaign?:{network_campaign_id:number;name?:string};
  };
  [key:string]:unknown;
};

export type ConversionCacheRow={
  id:string;type:'soi'|'first_sale'|'rebill';converted_at:string;offer_url_id:string|null;source_id:string|null;sub_source:string|null;
  cost:number;revenue:number;payout:number;lead_id:string;raw:Record<string,unknown>;status:string|null;affiliate_id:string|null;affiliate_name:string|null;
  offer_id:string|null;offer_name:string|null;offer_url_name:string|null;campaign_id:string|null;campaign_name:string|null;
};

export type DailyMetricRow={
  id:string;metric_date:string;affiliate_id:string;affiliate_name:string;offer_id:string;offer_name:string;campaign_id:string;campaign_name:string;
  offer_url_id:string;offer_url_name:string;source_id:string;sub_source:string;clicks:number;sois:number;first_sales:number;rebills:number;
  coin_spend:number;payout:number;revenue:number;profit:number;raw:Record<string,unknown>;
};

const DAY=86_400_000;
const isoDay=(value:Date)=>value.toISOString().slice(0,10);
const berlinDay=(value:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
const fromDay=(value:string)=>new Date(`${value}T12:00:00Z`);
const shift=(value:string,days:number)=>isoDay(new Date(fromDay(value).getTime()+days*DAY));
export function resolveManualSourceRange(params:Pick<URLSearchParams,'get'>,now=new Date()){const from=params.get('from')||'',to=params.get('to')||'',valid=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;if(!valid(from)||!valid(to)||from>to)throw new Error('Ungültiger Source-Zeitraum');const days=Math.floor((fromDay(to).getTime()-fromDay(from).getTime())/DAY)+1;if(days>31)throw new Error('Source-Refresh darf höchstens 31 Tage umfassen');const today=berlinDay(now);if(to>today)throw new Error('Source-Refresh darf nicht in der Zukunft liegen');if(from<shift(today,-364))throw new Error('Source-Refresh liegt außerhalb der 365-Tage-Aufbewahrung');return{from,to}}

export async function loadDailyReportSlices<T>(from:string,to:string,loadDay:(day:string)=>Promise<T[]>,rowCap=10_000,concurrency=1){
  const days:string[]=[],rows:T[]=[];
  for(let day=from;day<=to;day=shift(day,1))days.push(day);
  const width=Math.max(1,Math.min(10,Math.floor(concurrency)||1));
  for(let start=0;start<days.length;start+=width){
    const slice=days.slice(start,start+width),batches=await Promise.all(slice.map(day=>loadDay(day)));
    for(let index=0;index<batches.length;index++){const batch=batches[index],day=slice[index];if(batch.length>=rowCap)throw new Error(`Everflow daily entity report reached the ${rowCap.toLocaleString('en-US')}-row cap for ${day}`);rows.push(...batch)}
  }
  return rows;
}

export function initialSyncState(now=new Date()):SyncState{
  const end=berlinDay(now);
  return{phase:'backfill',backfill_start:shift(end,-364),next_end:end,last_success_at:null};
}

export function selectSyncWindow(state:SyncState,now=new Date()):SyncWindow{
  if(state.phase==='rolling'){
    const to=berlinDay(now);
    return{mode:'rolling',from:shift(to,-1),to};
  }
  const to=state.next_end;
  const candidate=shift(to,-6);
  return{mode:'backfill',from:candidate<state.backfill_start?state.backfill_start:candidate,to};
}

export function advanceSyncState(state:SyncState,window:SyncWindow,now=new Date()):SyncState{
  if(window.mode==='rolling')return{...state,phase:'rolling',last_success_at:now.toISOString()};
  const nextEnd=shift(window.from,-1);
  return{...state,phase:nextEnd<state.backfill_start?'rolling':'backfill',next_end:nextEnd,last_success_at:now.toISOString()};
}

const text=(value:unknown)=>value===undefined||value===null||value===''?null:String(value);
const amount=(value:unknown)=>Number.isFinite(Number(value))?Number(value):0;

export function conversionToCacheRow(row:EverflowConversion):ConversionCacheRow|null{
  const normalized=row.event.trim().toLowerCase();
  const type=(!row.is_event&&(normalized==='soi'||normalized==='cpl soi'))?'soi':row.is_event&&normalized==='sale'?'first_sale':row.is_event&&normalized==='rebill'?'rebill':null;
  if(!type)return null;
  const relationship=row.relationship||{};
  const fallback=[row.transaction_id,type,row.event,row.conversion_unix_timestamp].map(encodeURIComponent).join(':');
  return{
    id:text(row.conversion_id)||fallback,type,converted_at:new Date(row.conversion_unix_timestamp*1000).toISOString(),
    offer_url_id:text(relationship.offer_url?.network_offer_url_id),source_id:text(row.source_id),sub_source:text(row.sub1),cost:amount(row.cost),
    revenue:amount(row.revenue),payout:amount(row.payout),lead_id:row.transaction_id,raw:{transaction_id:row.transaction_id,event:row.event,is_event:row.is_event,conversion_unix_timestamp:row.conversion_unix_timestamp,relationship:{campaign:relationship.campaign?{network_campaign_id:relationship.campaign.network_campaign_id,name:relationship.campaign.name}:undefined,offer:relationship.offer?{network_offer_id:relationship.offer.network_offer_id,name:relationship.offer.name}:undefined,offer_url:relationship.offer_url?{network_offer_url_id:relationship.offer_url.network_offer_url_id,name:relationship.offer_url.name}:undefined}},status:text(row.status),
    affiliate_id:text(relationship.affiliate?.network_affiliate_id),affiliate_name:text(relationship.affiliate?.name),offer_id:text(relationship.offer?.network_offer_id),
    offer_name:text(relationship.offer?.name),offer_url_name:text(relationship.offer_url?.name),campaign_id:text(relationship.campaign?.network_campaign_id),
    campaign_name:text(relationship.campaign?.name),
  };
}

const dim=(row:ReportRow,type:string)=>row.columns.find(column=>column.column_type===type)||{id:'',label:''};
const metricDimensions=['date','affiliate','offer','campaign','offer_url','source_id','sub1','adv1','adv2'];
const legacyMetricDimensions=['date','affiliate','offer','campaign','offer_url','source_id','sub1'];
const metricKey=(row:ReportRow)=>metricDimensions.map(type=>dim(row,type).id||'').join('|');
const dayFromDimension=(row:ReportRow)=>new Date(Number(dim(row,'date').id)*1000).toISOString().slice(0,10);
const stableMetricId=(row:ReportRow)=>`metric:${metricDimensions.map(type=>encodeURIComponent(dim(row,type).id||'')).join(':')}`;
const legacyStableMetricId=(row:ReportRow)=>`metric:${legacyMetricDimensions.map(type=>encodeURIComponent(dim(row,type).id||'')).join(':')}`;

export type SyncStore={
  getState:()=>Promise<SyncState|null>;
  upsertConversions:(rows:ConversionCacheRow[])=>Promise<void>;
  upsertMetrics:(rows:DailyMetricRow[])=>Promise<void>;
  replaceMetrics?:(from:string,to:string,rows:DailyMetricRow[])=>Promise<void>;
  setState:(state:SyncState)=>Promise<void>;
};

export async function refreshHistoryRange(input:{store:SyncStore;from:string;to:string;includeConversions?:boolean;loadConversions:(from:string,to:string)=>Promise<EverflowConversion[]>;loadReports:(from:string,to:string)=>Promise<{base:ReportRow[];events:ReportRow[]}>}){
  const[rawConversions,reports]=input.includeConversions===false?[[],await input.loadReports(input.from,input.to)]:await Promise.all([input.loadConversions(input.from,input.to),input.loadReports(input.from,input.to)]);
  const mapped=rawConversions.map(conversionToCacheRow).filter((row):row is ConversionCacheRow=>row!==null),conversions=Array.from(new Map(mapped.map(row=>[row.id,row])).values()),metrics=metricRows(reports.base,reports.events);
  await input.store.upsertConversions(conversions);if(input.store.replaceMetrics)await input.store.replaceMetrics(input.from,input.to,metrics);else await input.store.upsertMetrics(metrics);
  return{conversions,metrics};
}

export async function runHistorySync(input:{
  store:SyncStore;now?:Date;
  loadConversions:(from:string,to:string)=>Promise<EverflowConversion[]>;
  loadReports:(from:string,to:string)=>Promise<{base:ReportRow[];events:ReportRow[]}>;
}){
  const now=input.now||new Date();
  const state=await input.store.getState()||initialSyncState(now);
  if(state.phase==='rolling'&&state.last_success_at&&now.getTime()-Date.parse(state.last_success_at)<55*60_000){
    const window=selectSyncWindow(state,now);
    return{mode:'rolling' as const,from:window.from,to:window.to,upsertedConversions:0,upsertedMetrics:0,backfillComplete:true,skipped:true};
  }
  const window=selectSyncWindow(state,now);
  const today=berlinDay(now);
  if(window.mode==='backfill')await refreshHistoryRange({store:input.store,from:shift(today,-29),to:today,includeConversions:false,loadConversions:input.loadConversions,loadReports:input.loadReports});
  const retentionFrom=shift(today,-364),segments:Array<{from:string;to:string;includeConversions:boolean}>=[];
  if(window.mode==='backfill'&&window.from<retentionFrom){const expiredTo=window.to<retentionFrom?window.to:shift(retentionFrom,-1);segments.push({from:window.from,to:expiredTo,includeConversions:false});if(window.to>=retentionFrom)segments.push({from:retentionFrom,to:window.to,includeConversions:true})}else segments.push({from:window.from,to:window.to,includeConversions:true});
  const conversions:ConversionCacheRow[]=[],metrics:DailyMetricRow[]=[];for(const segment of segments){const result=await refreshHistoryRange({store:input.store,...segment,loadConversions:input.loadConversions,loadReports:input.loadReports});conversions.push(...result.conversions);metrics.push(...result.metrics)};
  const next=advanceSyncState(state,window,now);
  await input.store.setState(next);
  return{mode:window.mode,from:window.from,to:window.to,upsertedConversions:conversions.length,upsertedMetrics:metrics.length,backfillComplete:next.phase==='rolling'};
}

export function metricRows(baseRows:ReportRow[],eventRows:ReportRow[]):DailyMetricRow[]{
  const map=new Map<string,DailyMetricRow>();
  for(const row of baseRows){
    const q=row.reporting;
    map.set(metricKey(row),{
      id:stableMetricId(row),metric_date:dayFromDimension(row),affiliate_id:dim(row,'affiliate').id||'0',affiliate_name:dim(row,'affiliate').label||'N/A',
      offer_id:dim(row,'offer').id||'0',offer_name:dim(row,'offer').label||'N/A',campaign_id:dim(row,'campaign').id||'0',campaign_name:dim(row,'campaign').label||'N/A',
      offer_url_id:dim(row,'offer_url').id||'0',offer_url_name:dim(row,'offer_url').label||'N/A',source_id:dim(row,'source_id').id||'',sub_source:dim(row,'sub1').id||'',
      clicks:amount(q.total_click),sois:amount(q.cv),first_sales:0,rebills:0,coin_spend:0,payout:amount(q.payout),revenue:amount(q.revenue),
      profit:amount(q.revenue)-amount(q.payout),raw:{traffic_mode:isApiOffer(dim(row,'offer').label||'')?'api':'tracked',adv1:dim(row,'adv1').id||'',adv2:dim(row,'adv2').id||'',canonical_id:legacyStableMetricId(row)},
    });
  }
  for(const row of eventRows){
    const target=map.get(metricKey(row));
    if(!target)continue;
    const count=amount(row.reporting.event),event=dim(row,'event_name').label;
    if(event==='Sale')target.first_sales+=count;
    else if(event==='Rebill')target.rebills+=count;
    else if(event==='Coin Spend')target.coin_spend+=count;
  }
  return Array.from(map.values());
}

export function canonicalMetricRows(rows:DailyMetricRow[]):DailyMetricRow[]{
  const grouped=new Map<string,DailyMetricRow>();
  for(const row of rows){
    const id=String(row.raw.canonical_id||row.id),current=grouped.get(id)||{...row,id,clicks:0,sois:0,first_sales:0,rebills:0,coin_spend:0,payout:0,revenue:0,profit:0,raw:{}};
    for(const metric of['clicks','sois','first_sales','rebills','coin_spend','payout','revenue','profit']as const)current[metric]+=row[metric];
    grouped.set(id,current);
  }
  return Array.from(grouped.values());
}
export const staleMetricIds=(existingIds:string[],currentRows:DailyMetricRow[])=>{const current=new Set(currentRows.map(row=>row.id));return existingIds.filter(id=>!current.has(id))};
