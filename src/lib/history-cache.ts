export type SyncPhase='backfill'|'rolling';
export type SyncState={phase:SyncPhase;backfill_start:string;next_end:string;last_success_at:string|null;snapshot_version?:number};
export type SyncWindow={mode:SyncPhase;from:string;to:string};
export type ReportRow={columns:{column_type:string;id:string;label:string}[];reporting:Record<string,number>};
import{createHash}from'node:crypto';
import{classifyTrafficPath,normalizeFraudSource,type FraudTrafficMode}from'./fraud-control';

export type EverflowConversion={
  conversion_id?:string;transaction_id:string;click_unix_timestamp?:number;conversion_unix_timestamp:number;is_event:boolean;event:string;status?:string;
  payout?:number;revenue?:number;cost?:number;source_id?:string;sub1?:string;sub2?:string;sub3?:string;sub4?:string;sub5?:string;adv1?:string;adv2?:string;adv4?:string;email?:string;country?:string;is_scrub?:boolean;error_code?:string;
  relationship?:{
    affiliate?:{network_affiliate_id:number;name?:string};offer?:{network_offer_id:number;name?:string};
    offer_url?:{network_offer_url_id:number;name?:string};campaign?:{network_campaign_id:number;name?:string};
  };
  [key:string]:unknown;
};

export type ConversionCacheRow={
  id:string;type:'soi'|'coin_spend'|'first_sale'|'rebill';converted_at:string;click_at:string|null;offer_url_id:string|null;source_id:string|null;sub_source:string|null;
  source_dimension:string;sub_source_dimension:string;traffic_mode:FraudTrafficMode;country_code:string|null;is_scrub:boolean;error_code:string|null;
  cost:number;revenue:number;payout:number;lead_id:string;raw:Record<string,unknown>;status:string|null;affiliate_id:string|null;affiliate_name:string|null;
  offer_id:string|null;offer_name:string|null;offer_url_name:string|null;campaign_id:string|null;campaign_name:string|null;
};

export type DailyMetricRow={
  id:string;metric_date:string;affiliate_id:string;affiliate_name:string;offer_id:string;offer_name:string;campaign_id:string;campaign_name:string;
  offer_url_id:string;offer_url_name:string;source_id:string;sub_source:string;clicks:number;sois:number;first_sales:number;rebills:number;
  coin_spend:number;payout:number;revenue:number;profit:number;raw:Record<string,unknown>;
};

const DAY=86_400_000;
const SOURCE_SNAPSHOT_VERSION=4;
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
  return{phase:'backfill',backfill_start:shift(end,-364),next_end:end,last_success_at:null,snapshot_version:SOURCE_SNAPSHOT_VERSION};
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
export function conversionReportBody(from:string,to:string,affiliateId?:string){if(affiliateId!==undefined&&!/^\d+$/.test(affiliateId))throw new Error('Ungültige Affiliate-ID');return{from,to,timezone_id:80,currency_id:'EUR',show_conversions:true,show_events:true,query:{filters:affiliateId?[{resource_type:'affiliate',filter_id_value:affiliateId}]:[],search_terms:[]}}}

export function conversionToCacheRow(row:EverflowConversion):ConversionCacheRow|null{
  const normalized=row.event.trim().toLowerCase();
  const type=(!row.is_event&&(normalized==='soi'||normalized==='cpl soi'))?'soi':row.is_event&&normalized==='coin spend'?'coin_spend':row.is_event&&normalized==='sale'?'first_sale':row.is_event&&normalized==='rebill'?'rebill':null;
  if(!type)return null;
  const relationship=row.relationship||{};
  const traffic_mode=classifyTrafficPath({campaignId:text(relationship.campaign?.network_campaign_id),clicks:row.click_unix_timestamp?1:0,offerName:relationship.offer?.name,offerUrlId:text(relationship.offer_url?.network_offer_url_id),sourceId:row.source_id,adv1:row.adv1,adv2:row.adv2});
  const source=normalizeFraudSource({trafficMode:traffic_mode,sourceId:row.source_id,sub1:row.sub1,sub2:row.sub2,sub3:row.sub3,sub4:row.sub4,sub5:row.sub5,adv1:row.adv1,adv2:row.adv2});
  const fallback=[row.transaction_id,type,row.event,row.conversion_unix_timestamp].map(encodeURIComponent).join(':');
  const eventIdentity=text(row.conversion_id)||fallback,apiCustomerIdentity=traffic_mode==='clickless_api'?(row.adv4?.trim().toLowerCase()||row.email?.trim().toLowerCase()||''):'',unjoinable=`unjoinable-sha256:${createHash('sha256').update(`${type}\u0000${eventIdentity}`).digest('hex')}`,customerId=traffic_mode==='clickless_api'?(apiCustomerIdentity?`api-customer-sha256:${createHash('sha256').update(apiCustomerIdentity).digest('hex')}`:unjoinable):traffic_mode==='unknown'?unjoinable:(row.transaction_id?.trim()||unjoinable),rawTrafficMode=traffic_mode==='clickless_api'?'api':traffic_mode==='unknown'?'unknown':'tracked';
  return{
    id:text(row.conversion_id)||fallback,type,converted_at:new Date(row.conversion_unix_timestamp*1000).toISOString(),
    click_at:row.click_unix_timestamp?new Date(row.click_unix_timestamp*1000).toISOString():null,offer_url_id:text(relationship.offer_url?.network_offer_url_id),source_id:source.source.startsWith('Nicht ')?null:source.source,sub_source:source.subSource.startsWith('Nicht ')?null:source.subSource,source_dimension:source.sourceDimension,sub_source_dimension:source.subSourceDimension,traffic_mode,country_code:text(row.country),is_scrub:Boolean(row.is_scrub),error_code:text(row.error_code),cost:amount(row.cost),
    revenue:amount(row.revenue),payout:amount(row.payout),lead_id:customerId,raw:{transaction_id:row.transaction_id,event:row.event,is_event:row.is_event,conversion_unix_timestamp:row.conversion_unix_timestamp,traffic_mode:rawTrafficMode,...(rawTrafficMode==='api'?{adv1:text(row.adv1),adv2:text(row.adv2)}:{source_id:text(row.source_id),sub1:text(row.sub1),sub2:text(row.sub2),sub3:text(row.sub3),sub4:text(row.sub4),sub5:text(row.sub5)}),relationship:{campaign:relationship.campaign?{network_campaign_id:relationship.campaign.network_campaign_id,name:relationship.campaign.name}:undefined,offer:relationship.offer?{network_offer_id:relationship.offer.network_offer_id,name:relationship.offer.name}:undefined,offer_url:relationship.offer_url?{network_offer_url_id:relationship.offer_url.network_offer_url_id,name:relationship.offer_url.name}:undefined}},status:text(row.status),
    affiliate_id:text(relationship.affiliate?.network_affiliate_id),affiliate_name:text(relationship.affiliate?.name),offer_id:text(relationship.offer?.network_offer_id),
    offer_name:text(relationship.offer?.name),offer_url_name:text(relationship.offer_url?.name),campaign_id:text(relationship.campaign?.network_campaign_id),
    campaign_name:text(relationship.campaign?.name),
  };
}

const dim=(row:ReportRow,type:string)=>row.columns.find(column=>column.column_type===type)||{id:'',label:''};
const metricDimensions=['date','affiliate','offer','campaign','offer_url','source_id','sub1','sub2','sub3','sub4','sub5','adv1','adv2'];
const legacyMetricDimensions=['date','affiliate','offer','campaign','offer_url','source_id','sub1'];
const metricDimensionId=(row:ReportRow,type:string)=>{const value=String(dim(row,type).id||'').trim();return!value||value.toUpperCase()==='N/A'?'' : value};
const reportTrafficMode=(row:ReportRow)=>classifyTrafficPath({campaignId:metricDimensionId(row,'campaign'),clicks:amount(row.reporting.total_click),offerName:dim(row,'offer').label,offerUrlId:metricDimensionId(row,'offer_url'),sourceId:metricDimensionId(row,'source_id'),adv1:metricDimensionId(row,'adv1'),adv2:metricDimensionId(row,'adv2')});
const reportSource=(row:ReportRow)=>normalizeFraudSource({trafficMode:reportTrafficMode(row),sourceId:metricDimensionId(row,'source_id'),sub1:metricDimensionId(row,'sub1'),sub2:metricDimensionId(row,'sub2'),sub3:metricDimensionId(row,'sub3'),sub4:metricDimensionId(row,'sub4'),sub5:metricDimensionId(row,'sub5'),adv1:metricDimensionId(row,'adv1'),adv2:metricDimensionId(row,'adv2')});
const dayFromDimension=(row:ReportRow)=>new Date(Number(dim(row,'date').id)*1000).toISOString().slice(0,10);
const stableDimensionId=(row:ReportRow,type:string)=>type==='date'?dayFromDimension(row):metricDimensionId(row,type);
const metricKey=(row:ReportRow)=>JSON.stringify(metricDimensions.map(type=>type==='date'?dayFromDimension(row):metricDimensionId(row,type)));
const stableMetricId=(row:ReportRow)=>`metric:${metricDimensions.map(type=>encodeURIComponent(stableDimensionId(row,type))).join(':')}`;
const legacyStableMetricId=(row:ReportRow)=>`metric:${legacyMetricDimensions.map(type=>encodeURIComponent(stableDimensionId(row,type))).join(':')}`;

export type SyncStore={
  getState:()=>Promise<SyncState|null>;
  upsertConversions:(rows:ConversionCacheRow[])=>Promise<void>;
  replaceConversions?:(from:string,to:string,rows:ConversionCacheRow[])=>Promise<void>;
  upsertMetrics:(rows:DailyMetricRow[])=>Promise<void>;
  replaceMetrics?:(from:string,to:string,rows:DailyMetricRow[])=>Promise<void>;
  setState:(state:SyncState)=>Promise<void>;
};

export async function refreshHistoryRange(input:{store:SyncStore;from:string;to:string;includeConversions?:boolean;loadConversions:(from:string,to:string)=>Promise<EverflowConversion[]>;loadReports:(from:string,to:string)=>Promise<{base:ReportRow[];events:ReportRow[]}>}){
  const[rawConversions,reports]=input.includeConversions===false?[[],await input.loadReports(input.from,input.to)]:await Promise.all([input.loadConversions(input.from,input.to),input.loadReports(input.from,input.to)]);
  const mapped=rawConversions.map(conversionToCacheRow).filter((row):row is ConversionCacheRow=>row!==null),conversions=Array.from(new Map(mapped.map(row=>[row.id,row])).values()),metrics=metricRows(reports.base,reports.events,input.includeConversions===false?undefined:rawConversions);
  await input.store.upsertConversions(conversions);if(input.store.replaceMetrics)await input.store.replaceMetrics(input.from,input.to,metrics);else await input.store.upsertMetrics(metrics);
  return{conversions,metrics};
}

export const conversionIdentityDigest=(rows:Pick<ConversionCacheRow,'id'|'type'>[])=>createHash('sha256').update(rows.map(row=>`${row.type}\u0000${row.id}`).sort().join('\n')).digest('hex');
export async function refreshConversionRange(input:{store:SyncStore;from:string;to:string;loadConversions:(from:string,to:string)=>Promise<EverflowConversion[]>}){
  const raw=await input.loadConversions(input.from,input.to),mapped=raw.map(conversionToCacheRow).filter((row):row is ConversionCacheRow=>row!==null),conversions=Array.from(new Map(mapped.map(row=>[row.id,row])).values()),typeCounts={soi:0,coin_spend:0,first_sale:0,rebill:0};
  for(const row of conversions)typeCounts[row.type]++;
  if(input.store.replaceConversions)await input.store.replaceConversions(input.from,input.to,conversions);else await input.store.upsertConversions(conversions);
  return{from:input.from,to:input.to,upsertedConversions:conversions.length,typeCounts,identityDigest:conversionIdentityDigest(conversions)};
}

export async function runHistorySync(input:{
  store:SyncStore;now?:Date;
  loadConversions:(from:string,to:string)=>Promise<EverflowConversion[]>;
  loadReports:(from:string,to:string)=>Promise<{base:ReportRow[];events:ReportRow[]}>;
}){
  const now=input.now||new Date();
  const storedState=await input.store.getState(),state=storedState?.snapshot_version===SOURCE_SNAPSHOT_VERSION?storedState:initialSyncState(now);
  if(state.phase==='rolling'&&state.last_success_at&&now.getTime()-Date.parse(state.last_success_at)<55*60_000){
    const window=selectSyncWindow(state,now);
    return{mode:'rolling' as const,from:window.from,to:window.to,upsertedConversions:0,upsertedMetrics:0,backfillComplete:true,skipped:true,conversionRows:[] as ConversionCacheRow[]};
  }
  const window=selectSyncWindow(state,now);
  const today=berlinDay(now);
  if(window.mode==='backfill')await refreshHistoryRange({store:input.store,from:shift(today,-29),to:today,loadConversions:input.loadConversions,loadReports:input.loadReports});
  const retentionFrom=shift(today,-364),segments:Array<{from:string;to:string;includeConversions:boolean}>=[];
  if(window.mode==='backfill'&&window.from<retentionFrom){const expiredTo=window.to<retentionFrom?window.to:shift(retentionFrom,-1);segments.push({from:window.from,to:expiredTo,includeConversions:false});if(window.to>=retentionFrom)segments.push({from:retentionFrom,to:window.to,includeConversions:true})}else segments.push({from:window.from,to:window.to,includeConversions:true});
  const conversions:ConversionCacheRow[]=[],metrics:DailyMetricRow[]=[];for(const segment of segments){const result=await refreshHistoryRange({store:input.store,...segment,loadConversions:input.loadConversions,loadReports:input.loadReports});conversions.push(...result.conversions);metrics.push(...result.metrics)};
  const next=advanceSyncState(state,window,now);
  await input.store.setState(next);
  return{mode:window.mode,from:window.from,to:window.to,upsertedConversions:conversions.length,upsertedMetrics:metrics.length,backfillComplete:next.phase==='rolling',conversionRows:conversions};
}

const conversionReportRow=(row:EverflowConversion):ReportRow=>{
  const relationship=row.relationship||{},day=berlinDay(new Date(row.conversion_unix_timestamp*1000)),column=(column_type:string,id:unknown,label:unknown=id)=>({column_type,id:text(id)||'',label:text(label)||text(id)||''});
  return{columns:[
    column('date',Date.parse(`${day}T00:00:00Z`)/1000,day),
    column('affiliate',relationship.affiliate?.network_affiliate_id,relationship.affiliate?.name),
    column('offer',relationship.offer?.network_offer_id,relationship.offer?.name),
    column('campaign',relationship.campaign?.network_campaign_id,relationship.campaign?.name),
    column('offer_url',relationship.offer_url?.network_offer_url_id,relationship.offer_url?.name),
    column('source_id',row.source_id),column('sub1',row.sub1),column('sub2',row.sub2),column('sub3',row.sub3),column('sub4',row.sub4),column('sub5',row.sub5),column('adv1',row.adv1),column('adv2',row.adv2),
  ],reporting:{}};
};

export function metricRows(baseRows:ReportRow[],eventRows:ReportRow[],conversionRows?:EverflowConversion[]):DailyMetricRow[]{
  const map=new Map<string,DailyMetricRow>(),authoritative=conversionRows!==undefined;
  const mappedRow=(row:ReportRow,includeTraffic:boolean):DailyMetricRow=>{
    const q=row.reporting,mode=reportTrafficMode(row),source=reportSource(row),payout=authoritative?0:amount(q.payout),revenue=authoritative?0:amount(q.revenue);
    return{
      id:stableMetricId(row),metric_date:dayFromDimension(row),affiliate_id:dim(row,'affiliate').id||'0',affiliate_name:dim(row,'affiliate').label||'N/A',
      offer_id:dim(row,'offer').id||'0',offer_name:dim(row,'offer').label||'N/A',campaign_id:dim(row,'campaign').id||'0',campaign_name:dim(row,'campaign').label||'N/A',
      offer_url_id:dim(row,'offer_url').id||'0',offer_url_name:dim(row,'offer_url').label||'N/A',source_id:mode==='clickless_api'?'':source.source.startsWith('Nicht ')?'':source.source,sub_source:mode==='clickless_api'?'':source.subSource.startsWith('Nicht ')?'':source.subSource,
      clicks:includeTraffic?amount(q.total_click):0,sois:includeTraffic&&!authoritative?amount(q.cv):0,first_sales:0,rebills:0,coin_spend:0,payout,revenue,
      profit:revenue-payout,raw:{traffic_mode:mode==='clickless_api'?'api':mode==='unknown'?'unknown':'tracked',source_dimension:source.sourceDimension,sub_source_dimension:source.subSourceDimension,sub1:metricDimensionId(row,'sub1'),sub2:metricDimensionId(row,'sub2'),sub3:metricDimensionId(row,'sub3'),sub4:metricDimensionId(row,'sub4'),sub5:metricDimensionId(row,'sub5'),adv1:dim(row,'adv1').id||'',adv2:dim(row,'adv2').id||'',canonical_id:legacyStableMetricId(row)},
    };
  };
  const baseKeys=new Set<string>();for(const row of baseRows){const key=metricKey(row);baseKeys.add(key);map.set(key,mappedRow(row,true))}
  if(!authoritative)for(const row of eventRows){
    const key=metricKey(row),exists=map.has(key),target=map.get(key)||mappedRow(row,false);if(!exists)map.set(key,target);else if(!baseKeys.has(key)){target.payout+=amount(row.reporting.payout);target.revenue+=amount(row.reporting.revenue);target.profit+=amount(row.reporting.revenue)-amount(row.reporting.payout)}
    const count=amount(row.reporting.event),event=dim(row,'event_name').label;
    if(event==='Sale')target.first_sales+=count;
    else if(event==='Rebill')target.rebills+=count;
    else if(event==='Coin Spend')target.coin_spend+=count;
  }
  if(conversionRows){
    const unique=new Map<string,{raw:EverflowConversion;mapped:ConversionCacheRow}>();
    for(const raw of conversionRows){const mapped=conversionToCacheRow(raw);if(mapped)unique.set(mapped.id,{raw,mapped})}
    for(const{raw,mapped}of unique.values()){
      if(mapped.is_scrub||mapped.status&&mapped.status.toLowerCase()!=='approved')continue;
      const report=conversionReportRow(raw),key=metricKey(report),target=map.get(key)||mappedRow(report,false);if(!map.has(key))map.set(key,target);
      if(mapped.type==='soi')target.sois++;
      else if(mapped.type==='first_sale')target.first_sales++;
      else if(mapped.type==='rebill')target.rebills++;
      else if(mapped.type==='coin_spend')target.coin_spend++;
      target.payout+=mapped.payout;target.revenue+=mapped.revenue;target.profit+=mapped.revenue-mapped.payout;
    }
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
