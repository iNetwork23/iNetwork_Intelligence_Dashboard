import {aggregatePortfolio,type Portfolio,type ReportRow} from './portfolio';
import{dailySeriesByKey,variantDailyKey,type DailyByKey}from'./daily-series';
import type{SupabaseClient}from'@supabase/supabase-js';
import type{PortfolioSnapshotRow}from'./affiliate-source-cache';
import{buildPortfolioRangePublication,buildPortfolioRangeSnapshotRecordFromAggregates,isPortfolioRangeSnapshotFresh,isValidPortfolioRangeSnapshot,stalePortfolioRangeSnapshotKeys,type PortfolioRangeSnapshotRecord}from'./portfolio-range-snapshots';
import{newSnapshotGeneration,snapshotGenerationCreatedAt}from'./snapshot-generation';
import{assertScopesSupported,filterPartnerRows,type AccessMetadata}from'./rbac';

export type ReportingPeriod='today'|'7d'|'30d'|'90d'|'12m'|'all'|'custom';
export const backgroundPortfolioPeriods=['7d','30d','90d','all']as const;
export type ReportingRange={from:string|null;to:string;label:string};
type RpcClient={rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:{message:string}|null}>};
type CacheClient=RpcClient&{from?:SupabaseClient['from']};
type MetricRpcRow={affiliate_id:string;affiliate_name:string;offer_id:string;offer_name:string;campaign_id:string;campaign_name:string;offer_url_id:string;offer_url_name:string;clicks:number|string;sois:number|string;first_sales:number|string;rebills:number|string;coin_spend:number|string;payout:number|string;revenue:number|string;profit:number|string};
const DAY=86_400_000;
const berlinDay=(date:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const shift=(day:string,count:number)=>new Date(Date.parse(`${day}T12:00:00Z`)+count*DAY).toISOString().slice(0,10);
const display=(day:string)=>{const[y,m,d]=day.split('-');return`${d}.${m}.${y}`};
const validDay=(value?:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value||'');

export function reportingRange(period:ReportingPeriod,now=new Date(),custom?:{from?:string;to?:string}):ReportingRange{
  const today=berlinDay(now);
  if(period==='all'){const from=shift(today,-364);return{from,to:today,label:`${display(from)}–${display(today)} (365 Tage)`}}
  if(period==='custom'){
    if(!validDay(custom?.from)||!validDay(custom?.to)||custom!.from!>custom!.to!)throw new Error('Ungültiger freier Zeitraum');
    return{from:custom!.from!,to:custom!.to!,label:`${display(custom!.from!)}–${display(custom!.to!)}`};
  }
  const days=period==='today'?1:period==='7d'?7:period==='30d'?30:period==='90d'?90:365;
  const from=shift(today,-(days-1));
  return{from,to:today,label:from===today?display(today):`${from.slice(8,10)}.–${display(today)}`};
}

const columns=(row:MetricRpcRow)=>[
  {column_type:'affiliate',id:row.affiliate_id,label:row.affiliate_name},
  {column_type:'offer',id:row.offer_id,label:row.offer_name},
  {column_type:'campaign',id:row.campaign_id,label:row.campaign_name},
  {column_type:'offer_url',id:row.offer_url_id,label:row.offer_url_name},
];
const number=(value:number|string)=>Number(value||0);
function reportRows(rows:MetricRpcRow[]){
  const base:ReportRow[]=[],events:ReportRow[]=[];
  for(const row of rows){
    const dimensions=columns(row);
    base.push({columns:dimensions,reporting:{total_click:number(row.clicks),cv:number(row.sois),payout:number(row.payout),revenue:number(row.revenue),profit:number(row.profit)}});
    for(const [label,value] of [['Sale',row.first_sales],['Rebill',row.rebills],['Coin Spend',row.coin_spend]] as const){
      if(number(value))events.push({columns:[...dimensions,{column_type:'event_name',id:label,label}],reporting:{event:number(value)}});
    }
  }
  return{base,events};
}
function aggregateMetricRows(rows:MetricRpcRow[]){const grouped=new Map<string,MetricRpcRow>();for(const row of rows){const key=[row.affiliate_id,row.offer_id,row.campaign_id,row.offer_url_id].join('\u0000'),current=grouped.get(key)||{...row,clicks:0,sois:0,first_sales:0,rebills:0,coin_spend:0,payout:0,revenue:0,profit:0};for(const metric of['clicks','sois','first_sales','rebills','coin_spend','payout','revenue','profit']as const)current[metric]=number(current[metric])+number(row[metric]);grouped.set(key,current)}return Array.from(grouped.values())}
const decodePortfolioRow=(row:PortfolioSnapshotRow):MetricRpcRow=>({affiliate_id:row.a,affiliate_name:row.an,offer_id:row.o,offer_name:row.on,campaign_id:row.c,campaign_name:row.cn,offer_url_id:row.u,offer_url_name:row.un,clicks:row.cl,sois:row.cv,first_sales:row.fs,rebills:row.rb,coin_spend:row.cs,payout:row.p,revenue:row.r,profit:row.pr});
async function loadMetricRows(client:CacheClient,range:ReportingRange,preferRangeSnapshot=true){if(!client.from){const{data,error}=await client.rpc('portfolio_metric_rows',{p_from:range.from,p_to:range.to});if(error)throw new Error(`Supabase portfolio_metric_rows: ${error.message}`);return(data||[])as MetricRpcRow[]}const db=client as unknown as SupabaseClient;if(preferRangeSnapshot&&range.from){
 const markerKey=`portfolio_range_generation:${range.from}:${range.to}`;
 const{data:markerData,error:markerError}=await db.from('sync_state').select('value').eq('key',markerKey).maybeSingle();
 if(markerError)throw new Error(`Supabase portfolio range marker: ${markerError.message}`);
 const marker=markerData?.value as{version?:number;from?:string;to?:string;generation?:string}|undefined;
 if(marker?.version===2&&marker.from===range.from&&marker.to===range.to&&typeof marker.generation==='string'&&marker.generation){
  let rangeFresh=true;if(snapshotGenerationCreatedAt(marker.generation)!==null){const{data:dayMarkerData,error:dayMarkerError}=await db.from('sync_state').select('value').gte('key',`portfolio_day_generation:${range.from}`).lte('key',`portfolio_day_generation:${range.to}`).order('key');
   if(dayMarkerError)throw new Error(`Supabase portfolio day freshness: ${dayMarkerError.message}`);rangeFresh=isPortfolioRangeSnapshotFresh(marker.generation,(dayMarkerData||[]).map(item=>String((item.value as{generation?:string}).generation||'')))}
  if(rangeFresh){const{data,error}=await db.from('sync_state').select('value').eq('key',`portfolio_range:${range.from}:${range.to}:${marker.generation}`).maybeSingle();
   if(error)throw new Error(`Supabase portfolio range snapshot: ${error.message}`);
   if(isValidPortfolioRangeSnapshot(data?.value,range.from,range.to,marker.generation))return data.value.rows.map(decodePortfolioRow)}
 }else if(!markerData){
  const{data,error}=await db.from('sync_state').select('value').eq('key',`portfolio_range:${range.from}:${range.to}`).maybeSingle();
  if(error)throw new Error(`Supabase legacy portfolio range snapshot: ${error.message}`);
  if(isValidPortfolioRangeSnapshot(data?.value,range.from,range.to))return data.value.rows.map(decodePortfolioRow);
 }
}const days:string[]=[];if(range.from)for(let day=range.from;day<=range.to;day=shift(day,1))days.push(day);if(range.from){const{data:markerData,error:markerError}=await db.from('sync_state').select('value').gte('key',`portfolio_day_generation:${range.from}`).lte('key',`portfolio_day_generation:${range.to}`).order('key');if(markerError)throw new Error(`Supabase portfolio markers: ${markerError.message}`);const markers=new Map((markerData||[]).map(item=>{const value=item.value as{date?:string;generation?:string};return[value.date||'',value.generation||'']}));if(days.length<=45&&days.every(day=>markers.get(day))){const keys=days.map(day=>`portfolio_day:${day}:${markers.get(day)}`),snapshotRows:MetricRpcRow[]=[];let found=0;for(let start=0;start<keys.length;start+=5){const{data,error}=await db.from('sync_state').select('value').in('key',keys.slice(start,start+5));if(error)throw new Error(`Supabase portfolio snapshots: ${error.message}`);for(const item of data||[]){const value=item.value as{rows?:PortfolioSnapshotRow[]};if(Array.isArray(value.rows)){found++;snapshotRows.push(...value.rows.map(decodePortfolioRow))}}}if(found===days.length)return aggregateMetricRows(snapshotRows)}}const select='affiliate_id,affiliate_name,offer_id,offer_name,campaign_id,campaign_name,offer_url_id,offer_url_name,clicks,sois,first_sales,rebills,coin_spend,payout,revenue,profit',rows:MetricRpcRow[]=[];if(days.length>45){const loadDay=async(day:string)=>{const result:MetricRpcRow[]=[];for(let start=0;;start+=1000){const{data,error}=await db.from('daily_metrics').select(select).eq('metric_date',day).order('id').range(start,start+999);if(error)throw new Error(`Supabase daily portfolio ${day}: ${error.message}`);const batch=(data||[])as MetricRpcRow[];result.push(...batch);if(batch.length<1000)break}return result};for(let start=0;start<days.length;start+=12)for(const batch of await Promise.all(days.slice(start,start+12).map(loadDay)))rows.push(...batch);return aggregateMetricRows(rows)}for(let start=0;;start+=1000){let query=db.from('daily_metrics').select(select).lte('metric_date',range.to);if(range.from)query=query.gte('metric_date',range.from);const{data,error}=await query.order('metric_date').order('id').range(start,start+999);if(error)throw new Error(`Supabase daily_metrics portfolio: ${error.message}`);const batch=(data||[])as MetricRpcRow[];rows.push(...batch);if(batch.length<1000)break}return aggregateMetricRows(rows)}

export async function publishPortfolioRangeRecords(client:CacheClient,records:PortfolioRangeSnapshotRecord[],generation=newSnapshotGeneration()){
 if(!client.from)throw new Error('Supabase range publication requires a table client');
 const db=client as unknown as SupabaseClient,publication=buildPortfolioRangePublication(records,generation);
 const{error:snapshotError}=await db.from('sync_state').upsert(publication.snapshots,{onConflict:'key'});
 if(snapshotError)throw new Error(`Supabase portfolio range snapshots: ${snapshotError.message}`);
 const{error:markerError}=await db.from('sync_state').upsert(publication.markers,{onConflict:'key'});
 if(markerError)throw new Error(`Supabase portfolio range markers: ${markerError.message}`);
 const cutoff=Date.now()-24*60*60_000;
 for(const record of records){
  const prefix=`portfolio_range:${record.value.from}:${record.value.to}:`,keys:string[]=[];
  for(let start=0;;start+=1000){const{data,error}=await db.from('sync_state').select('key').like('key',`${prefix}%`).order('key').range(start,start+999);if(error)throw new Error(`Supabase portfolio range generation list: ${error.message}`);const batch=(data||[]).map(row=>row.key as string);keys.push(...batch);if(batch.length<1000)break}
  const candidates=stalePortfolioRangeSnapshotKeys(keys,prefix,'',cutoff),markerKey=`portfolio_range_generation:${record.value.from}:${record.value.to}`;
  for(let start=0;start<candidates.length;start+=200){
   const{data,error:markerError}=await db.from('sync_state').select('value').eq('key',markerKey).maybeSingle();
   if(markerError)throw new Error(`Supabase portfolio range marker recheck: ${markerError.message}`);
   const active=(data?.value as{generation?:string}|undefined)?.generation;
   if(!active)continue;
   const safe=stalePortfolioRangeSnapshotKeys(candidates.slice(start,start+200),prefix,active,cutoff);
   if(!safe.length)continue;
   const{error}=await db.from('sync_state').delete().in('key',safe);if(error)throw new Error(`Supabase stale portfolio range delete: ${error.message}`);
  }
 }
 return publication;
}

export async function refreshLongPortfolioRangeSnapshots(client:CacheClient,now=new Date()){
 if(!client.from)throw new Error('Supabase range rollups require a table client');
 const records=[];
 for(const period of backgroundPortfolioPeriods){
  const range=reportingRange(period,now),rows=await loadMetricRows(client,range,false);
  records.push(buildPortfolioRangeSnapshotRecordFromAggregates(range.from!,range.to,rows.map(row=>({...row,clicks:number(row.clicks),sois:number(row.sois),first_sales:number(row.first_sales),rebills:number(row.rebills),coin_spend:number(row.coin_spend),payout:number(row.payout),revenue:number(row.revenue),profit:number(row.profit)}))));
 }
 await publishPortfolioRangeRecords(client,records);
 return records.map(record=>({key:record.key,rows:record.value.rows.length}));
}

export async function loadPortfolioFromCache(period:ReportingPeriod,client:CacheClient,now=new Date(),custom?:{from?:string;to?:string},access?:AccessMetadata):Promise<Portfolio>{
  const range=reportingRange(period,now,custom);
  const loaded=await loadMetricRows(client,range);
  if(access)assertScopesSupported(access,['affiliate','offer','campaign']);
  const scoped=access?filterPartnerRows(loaded as unknown as Array<Record<string,unknown>>,access) as unknown as MetricRpcRow[]:loaded;
  const reports=reportRows(scoped);
  return aggregatePortfolio(reports.base,reports.events,{from:range.from||'Gesamt',to:range.to,label:range.label});
}

/** Etappe 3 (additiv): Tagesreihe für Sparklines aus denselben Tages-Snapshots (portfolio_day) – nur für Fenster bis 45 Tage. */
export type PortfolioDailyPoint={date:string;clicks:number;sois:number;firstSales:number;rebills:number;revenue:number;payout:number;profit:number};
export const DAILY_SERIES_MAX_DAYS=45;
export const rangeDayCount=(range:{from:string|null;to:string})=>range.from?Math.round((Date.parse(`${range.to}T12:00:00Z`)-Date.parse(`${range.from}T12:00:00Z`))/DAY)+1:Number.POSITIVE_INFINITY;
/** Gleich lange Spanne unmittelbar vor dem Fenster; null ohne Startdatum oder über der 45-Tage-Grenze. */
export function previousReportingRange(range:ReportingRange):{from:string;to:string}|null{const days=rangeDayCount(range);if(!range.from||!Number.isFinite(days)||days>DAILY_SERIES_MAX_DAYS)return null;return{from:shift(range.from,-days),to:shift(range.from,-1)}}
const sumDay=(date:string,rows:MetricRpcRow[]):PortfolioDailyPoint=>{const point:PortfolioDailyPoint={date,clicks:0,sois:0,firstSales:0,rebills:0,revenue:0,payout:0,profit:0};for(const row of rows){point.clicks+=number(row.clicks);point.sois+=number(row.sois);point.firstSales+=number(row.first_sales);point.rebills+=number(row.rebills);point.revenue+=number(row.revenue);point.payout+=number(row.payout);point.profit+=number(row.profit)}for(const key of['revenue','payout','profit']as const)point[key]=Number(point[key].toFixed(2));return point};
/** Liest je Tag den aktiven Tages-Snapshot (Batches zu 5 Keys wie der Portfolio-Pfad) und summiert im Scope; undefined, sobald ein Tag fehlt oder das Fenster zu lang ist. */
/** Tages-Snapshots (portfolio_day) eines Fensters ≤ 45 Tage, nur wenn jeder Tag einen Snapshot hat; sonst undefined. */
async function loadPortfolioDayRows(client:CacheClient,range:ReportingRange):Promise<{days:string[];byDay:Map<string,MetricRpcRow[]>}|undefined>{
 if(!client.from||!range.from||rangeDayCount(range)>DAILY_SERIES_MAX_DAYS)return undefined;
 const db=client as unknown as SupabaseClient,days:string[]=[];for(let day=range.from;day<=range.to;day=shift(day,1))days.push(day);
 const{data:markerData,error:markerError}=await db.from('sync_state').select('value').gte('key',`portfolio_day_generation:${range.from}`).lte('key',`portfolio_day_generation:${range.to}`).order('key');
 if(markerError)throw new Error(`Supabase portfolio daily markers: ${markerError.message}`);
 const markers=new Map((markerData||[]).map(item=>{const value=item.value as{date?:string;generation?:string};return[value.date||'',value.generation||'']}));
 if(!days.every(day=>markers.get(day)))return undefined;
 const keys=days.map(day=>`portfolio_day:${day}:${markers.get(day)}`),byDay=new Map<string,MetricRpcRow[]>();
 for(let start=0;start<keys.length;start+=5){const{data,error}=await db.from('sync_state').select('value').in('key',keys.slice(start,start+5));if(error)throw new Error(`Supabase portfolio daily snapshots: ${error.message}`);for(const item of data||[]){const value=item.value as{date?:string;rows?:PortfolioSnapshotRow[]};if(typeof value.date==='string'&&Array.isArray(value.rows))byDay.set(value.date,value.rows.map(decodePortfolioRow))}}
 if(byDay.size!==days.length)return undefined;
 return{days,byDay};
}
const scopedDayRows=(rows:MetricRpcRow[],access?:AccessMetadata)=>access?filterPartnerRows(rows as unknown as Array<Record<string,unknown>>,access) as unknown as MetricRpcRow[]:rows;
export async function loadPortfolioDailyFromCache(client:CacheClient,range:ReportingRange,access?:AccessMetadata):Promise<PortfolioDailyPoint[]|undefined>{
 const loaded=await loadPortfolioDayRows(client,range);
 if(!loaded)return undefined;
 if(access)assertScopesSupported(access,['affiliate','offer','campaign']);
 return loaded.days.map(day=>sumDay(day,scopedDayRows(loaded.byDay.get(day)||[],access)));
}
/** Etappe 3: Tagesprofit je Direkt-Variante (Schlüssel wie cockpitItemKey) für die Sparklines der priorisierten Cockpit-Liste; undefined ohne lückenlose Tages-Snapshots oder für Fenster > 45 Tage. */
export async function loadPortfolioDailyVariantProfitFromCache(client:CacheClient,range:ReportingRange,access?:AccessMetadata):Promise<DailyByKey|undefined>{
 const loaded=await loadPortfolioDayRows(client,range);
 if(!loaded)return undefined;
 if(access)assertScopesSupported(access,['affiliate','offer','campaign']);
 const points:Array<{date:string;key:string;value:number}>=[];
 for(const day of loaded.days)for(const row of scopedDayRows(loaded.byDay.get(day)||[],access))if(String(row.campaign_id)==='0')points.push({date:day,key:variantDailyKey(row),value:Number(row.profit)||0});
 return dailySeriesByKey(points,loaded.days);
}
