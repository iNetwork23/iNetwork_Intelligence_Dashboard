import 'server-only';
import type {Period} from './dashboard';
import type {ReportRow} from './portfolio';
import type {ConversionRow} from './everflow';
import {berlinDateRange} from './dashboard';
import {getSupabaseAdmin} from './supabase';

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

export async function loadAffiliateConversionsFromCache(affiliateId:string,lookbackDays=90,now=new Date()):Promise<ConversionRow[]>{
  const from=new Date(now.getTime()-(lookbackDays-1)*86_400_000).toISOString();
  const rows:ConversionRow[]=[];
  for(let start=0;;start+=1000){
    const {data,error}=await getSupabaseAdmin().from('conversions').select('raw,type').eq('affiliate_id',affiliateId).gte('converted_at',from).or('status.eq.approved,status.is.null').order('converted_at').range(start,start+999);
    if(error)throw new Error(`Supabase affiliate conversions: ${error.message}`);
    const batch=(data||[]).map(item=>{const raw=item.raw as ConversionRow;return item.type==='soi'&&raw.event==='CPL SOI'?{...raw,event:'SOI'}:raw});
    rows.push(...batch);
    if(batch.length<1000)break;
  }
  return rows;
}
