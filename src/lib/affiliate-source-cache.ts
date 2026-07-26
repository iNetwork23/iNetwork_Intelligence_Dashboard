import type{ReportRow}from'./portfolio';
import{isApiOffer}from'./affiliate-source-dimensions';
import type{DailyMetricRow}from'./history-cache';

export type DailySourceRow={affiliate_id:string;affiliate_name:string;offer_id:string;offer_name:string;campaign_id:string;campaign_name:string;offer_url_id:string;offer_url_name:string;source_id:string;sub_source:string;clicks:number|string;sois:number|string;first_sales:number|string;rebills:number|string;coin_spend:number|string;payout:number|string;revenue:number|string;profit:number|string;raw?:{traffic_mode?:'api'|'tracked';adv1?:string;adv2?:string}|null};
export type SourceSnapshotRow={o:string;on:string;c:string;cn:string;u:string;un:string;s:string;ss:string;m?:'api'|'tracked';a1?:string;a2?:string;cl:number;cv:number;fs:number;rb:number;cs:number;p:number;r:number;pr:number};
export type PortfolioSnapshotRow=SourceSnapshotRow&{a:string;an:string};
export const encodeSourceSnapshotRow=(row:DailyMetricRow):SourceSnapshotRow=>({o:row.offer_id,on:row.offer_name,c:row.campaign_id,cn:row.campaign_name,u:row.offer_url_id,un:row.offer_url_name,s:row.source_id,ss:row.sub_source,m:row.raw.traffic_mode as'api'|'tracked'|undefined,a1:String(row.raw.adv1||''),a2:String(row.raw.adv2||''),cl:row.clicks,cv:row.sois,fs:row.first_sales,rb:row.rebills,cs:row.coin_spend,p:row.payout,r:row.revenue,pr:row.profit});
export const encodePortfolioSnapshotRow=(row:DailyMetricRow):PortfolioSnapshotRow=>({a:row.affiliate_id,an:row.affiliate_name,...encodeSourceSnapshotRow(row)});
export const decodeSourceSnapshotRow=(row:SourceSnapshotRow,affiliateId:string,affiliateName:string):DailySourceRow=>({affiliate_id:affiliateId,affiliate_name:affiliateName,offer_id:row.o,offer_name:row.on,campaign_id:row.c,campaign_name:row.cn,offer_url_id:row.u,offer_url_name:row.un,source_id:row.s,sub_source:row.ss,clicks:row.cl,sois:row.cv,first_sales:row.fs,rebills:row.rb,coin_spend:row.cs,payout:row.p,revenue:row.r,profit:row.pr,raw:{traffic_mode:row.m,adv1:row.a1,adv2:row.a2}});
const n=(value:number|string)=>Number(value||0);
const sourceText=(value:unknown)=>{const text=String(value??'').trim();return!text||text.toUpperCase()==='N/A'?'':text};

export function mapAffiliateSourceRows(rows:DailySourceRow[],metricDate?:string):ReportRow[]{
  const grouped=new Map<string,DailySourceRow&{traffic_mode:'api'|'tracked';source_value:string;sub_value:string}>();
  for(const row of rows){
    const traffic_mode=row.raw?.traffic_mode||(isApiOffer(row.offer_name)?'api':'tracked'),source_value=sourceText(traffic_mode==='api'?row.raw?.adv1:row.source_id)||'Nicht übermittelt',sub_value=sourceText(traffic_mode==='api'?row.raw?.adv2:row.sub_source);
    const key=[row.affiliate_id,row.offer_id,row.campaign_id,row.offer_url_id,traffic_mode,source_value,sub_value].join('|');
    const current=grouped.get(key)||{...row,traffic_mode,source_value,sub_value,clicks:0,sois:0,first_sales:0,rebills:0,coin_spend:0,payout:0,revenue:0,profit:0};
    for(const metric of['clicks','sois','first_sales','rebills','coin_spend','payout','revenue','profit']as const)current[metric]=n(current[metric])+n(row[metric]);
    grouped.set(key,current);
  }
  return Array.from(grouped.values()).map(row=>({columns:[
    ...(metricDate?[{column_type:'date',id:metricDate,label:metricDate}]:[]),
    {column_type:'affiliate',id:row.affiliate_id,label:row.affiliate_name},{column_type:'offer',id:row.offer_id,label:row.offer_name},
    {column_type:'campaign',id:row.campaign_id,label:row.campaign_name},{column_type:'offer_url',id:row.offer_url_id,label:row.offer_url_name},
    {column_type:'traffic_mode',id:row.traffic_mode,label:row.traffic_mode},{column_type:'source_id',id:row.source_value,label:row.source_value},
    {column_type:'sub1',id:row.sub_value||'N/A',label:row.sub_value||'N/A'},
  ],reporting:{total_click:n(row.clicks),cv:n(row.sois),first_sales:n(row.first_sales),rebills:n(row.rebills),coin_spend:n(row.coin_spend),payout:n(row.payout),revenue:n(row.revenue),profit:n(row.profit)}}));
}
