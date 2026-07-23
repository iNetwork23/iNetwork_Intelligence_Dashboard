import {aggregatePortfolio,type Portfolio,type ReportRow} from './portfolio';
import type{SupabaseClient}from'@supabase/supabase-js';
import type{PortfolioSnapshotRow}from'./affiliate-source-cache';

export type ReportingPeriod='today'|'7d'|'30d'|'90d'|'12m'|'all'|'custom';
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
async function loadMetricRows(client:CacheClient,range:ReportingRange){if(!client.from){const{data,error}=await client.rpc('portfolio_metric_rows',{p_from:range.from,p_to:range.to});if(error)throw new Error(`Supabase portfolio_metric_rows: ${error.message}`);return(data||[])as MetricRpcRow[]}const db=client as unknown as SupabaseClient,days:string[]=[];if(range.from)for(let day=range.from;day<=range.to;day=shift(day,1))days.push(day);if(range.from){const{data:markerData,error:markerError}=await db.from('sync_state').select('value').gte('key',`portfolio_day_generation:${range.from}`).lte('key',`portfolio_day_generation:${range.to}`).order('key');if(markerError)throw new Error(`Supabase portfolio markers: ${markerError.message}`);const markers=new Map((markerData||[]).map(item=>{const value=item.value as{date?:string;generation?:string};return[value.date||'',value.generation||'']}));if(days.length<=45&&days.every(day=>markers.get(day))){const keys=days.map(day=>`portfolio_day:${day}:${markers.get(day)}`),snapshotRows:MetricRpcRow[]=[];let found=0;for(let start=0;start<keys.length;start+=50){const{data,error}=await db.from('sync_state').select('value').in('key',keys.slice(start,start+50));if(error)throw new Error(`Supabase portfolio snapshots: ${error.message}`);for(const item of data||[]){const value=item.value as{rows?:PortfolioSnapshotRow[]};if(Array.isArray(value.rows)){found++;snapshotRows.push(...value.rows.map(decodePortfolioRow))}}}if(found===days.length)return aggregateMetricRows(snapshotRows)}}const select='affiliate_id,affiliate_name,offer_id,offer_name,campaign_id,campaign_name,offer_url_id,offer_url_name,clicks,sois,first_sales,rebills,coin_spend,payout,revenue,profit',rows:MetricRpcRow[]=[];if(days.length>45){const loadDay=async(day:string)=>{const result:MetricRpcRow[]=[];for(let start=0;;start+=1000){const{data,error}=await db.from('daily_metrics').select(select).eq('metric_date',day).order('id').range(start,start+999);if(error)throw new Error(`Supabase daily portfolio ${day}: ${error.message}`);const batch=(data||[])as MetricRpcRow[];result.push(...batch);if(batch.length<1000)break}return result};for(let start=0;start<days.length;start+=12)for(const batch of await Promise.all(days.slice(start,start+12).map(loadDay)))rows.push(...batch);return aggregateMetricRows(rows)}for(let start=0;;start+=1000){let query=db.from('daily_metrics').select(select).lte('metric_date',range.to);if(range.from)query=query.gte('metric_date',range.from);const{data,error}=await query.order('metric_date').order('id').range(start,start+999);if(error)throw new Error(`Supabase daily_metrics portfolio: ${error.message}`);const batch=(data||[])as MetricRpcRow[];rows.push(...batch);if(batch.length<1000)break}return aggregateMetricRows(rows)}

export async function loadPortfolioFromCache(period:ReportingPeriod,client:CacheClient,now=new Date(),custom?:{from?:string;to?:string}):Promise<Portfolio>{
  const range=reportingRange(period,now,custom);
  const reports=reportRows(await loadMetricRows(client,range));
  return aggregatePortfolio(reports.base,reports.events,{from:range.from||'Gesamt',to:range.to,label:range.label});
}
