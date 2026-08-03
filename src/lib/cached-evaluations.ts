import 'server-only';
import type {Period} from './dashboard';
import type {ReportRow} from './portfolio';
import type {ConversionRow} from './everflow';
import {berlinDateRange} from './dashboard';
import {getSupabaseAdmin} from './supabase';
import{availableSourceSnapshotDays,decodeSourceSnapshotRow,mapAffiliateSourceRows,type SourceSnapshotRow}from'./affiliate-source-cache';
import{resolveSnapshotFreshness,type SnapshotFreshness}from'./snapshot-generation';

export{mapAffiliateSourceRows,type DailySourceRow}from'./affiliate-source-cache';
type SourceRow={affiliate_id:string;affiliate_name:string;offer_id:string;offer_name:string;campaign_id:string;campaign_name:string;offer_url_id:string;offer_url_name:string;source_id:string;sub_source:string;clicks:number|string;sois:number|string;payout:number|string;revenue:number|string;profit:number|string};
const n=(value:number|string)=>Number(value||0);
export async function loadAffiliateSourceRowsFromCache(period:Period,affiliateId:string,now=new Date()):Promise<ReportRow[]>{
  const range=berlinDateRange(period,now);
  const {data,error}=await getSupabaseAdmin().rpc('source_metric_rows',{p_from:range.from,p_to:range.to,p_affiliate_id:affiliateId});
  if(error)throw new Error(`Supabase source_metric_rows: ${error.message}`);
  return((data||[]) as SourceRow[]).map(row=>({columns:[
    {column_type:'affiliate',id:row.affiliate_id,label:row.affiliate_name},{column_type:'offer',id:row.offer_id,label:row.offer_name},
    {column_type:'campaign',id:row.campaign_id,label:row.campaign_name},{column_type:'offer_url',id:row.offer_url_id,label:row.offer_url_name},
    {column_type:'source_id',id:row.source_id||'N/A',label:row.source_id||'N/A'},{column_type:'sub1',id:row.sub_source||'N/A',label:row.sub_source||'N/A'},
  ],reporting:{total_click:n(row.clicks),cv:n(row.sois),payout:n(row.payout),revenue:n(row.revenue),profit:n(row.profit)}}));
}

export async function loadAffiliateSourceRowsRangeFromCache(range:{from:string;to:string},affiliateId:string):Promise<ReportRow[]>{
  const markerPrefix='source_day_generation:',markerQuery=await getSupabaseAdmin().from('sync_state').select('key,value').gte('key',`${markerPrefix}${range.from}`).lte('key',`${markerPrefix}${range.to}`).order('key');
  if(markerQuery.error)throw new Error(`Supabase source generations: ${markerQuery.error.message}`);
  const available=availableSourceSnapshotDays(range,(markerQuery.data||[]).map(item=>{const value=item.value as{version?:number;date?:string;generation?:string};return{version:Number(value.version||0),date:value.date||'',generation:value.generation||''}})),keys=available.map(marker=>`source_day:${marker.date}:${marker.generation}:${affiliateId}`),snapshotRows:ReportRow[]=[],snapshotBatches=Array.from({length:Math.ceil(keys.length/50)},(_,index)=>keys.slice(index*50,index*50+50));
  const results=await Promise.all(snapshotBatches.map(batch=>getSupabaseAdmin().from('sync_state').select('value').in('key',batch)));
  for(const result of results){if(result.error)throw new Error(`Supabase source snapshots: ${result.error.message}`);for(const item of result.data||[]){const value=item.value as{date?:string;affiliate_id?:string;affiliate_name?:string;rows?:SourceSnapshotRow[]};if(Array.isArray(value.rows)){const decoded=value.rows.map(row=>decodeSourceSnapshotRow(row,value.affiliate_id||affiliateId,value.affiliate_name||'N/A'));snapshotRows.push(...mapAffiliateSourceRows(decoded,value.date))}}}
  return snapshotRows;
}

export async function loadSourceSnapshotFreshness(range:{from:string;to:string}):Promise<SnapshotFreshness>{const prefix='source_day_generation:',{data,error}=await getSupabaseAdmin().from('sync_state').select('value').gte('key',`${prefix}${range.from}`).lte('key',`${prefix}${range.to}`).order('key');if(error)throw new Error(`Supabase source freshness: ${error.message}`);return resolveSnapshotFreshness(range.from,range.to,(data||[]).map(item=>{const value=item.value as{date?:string;generation?:string};return{date:value.date||'',generation:value.generation||''}}))}

export async function loadAffiliateConversionsFromCache(affiliateId:string,lookbackDays=90,now=new Date()):Promise<Array<ConversionRow&{stableCustomerId?:string}>>{
  const from=new Date(now.getTime()-(lookbackDays-1)*86_400_000).toISOString();
  const rows:Array<ConversionRow&{stableCustomerId?:string}>=[];
  for(let start=0;;start+=1000){
    const {data,error}=await getSupabaseAdmin().from('conversions').select('raw,type,lead_id').eq('affiliate_id',affiliateId).gte('converted_at',from).or('status.eq.approved,status.is.null').order('converted_at').order('id').range(start,start+999);
    if(error)throw new Error(`Supabase affiliate conversions: ${error.message}`);
    const databaseCount=(data||[]).length,batch=(data||[]).map(item=>{
      const raw=item.raw as ConversionRow,lead_id=typeof item.lead_id==='string'?item.lead_id:'';
      const normalized=item.type==='soi'&&raw.event==='CPL SOI'?{...raw,event:'SOI'}:raw;
      const stableApi=/^api-customer-sha256:[0-9a-f]{64}$/.test(lead_id)?lead_id:'',stableTracked=normalized.traffic_mode==='tracked'&&lead_id.length>0&&lead_id===normalized.transaction_id?`tracked-transaction:${lead_id}`:'';
      return stableApi||stableTracked?{...normalized,stableCustomerId:stableApi||stableTracked}:normalized;
    }).filter(row=>row?.transaction_id&&row?.event);
    rows.push(...batch);
    if(databaseCount<1000)break;
  }
  return rows;
}
