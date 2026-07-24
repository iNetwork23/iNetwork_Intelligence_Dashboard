import type{DailyMetricRow}from'./history-cache';
import{encodePortfolioSnapshotRow,type PortfolioSnapshotRow}from'./affiliate-source-cache';

const DAY=86_400_000;
const shift=(day:string,count:number)=>new Date(Date.parse(`${day}T12:00:00Z`)+count*DAY).toISOString().slice(0,10);
const dayCount=(from:string,to:string)=>Math.floor((Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/DAY)+1;
const metrics=['clicks','sois','first_sales','rebills','coin_spend','payout','revenue','profit']as const;

export type PortfolioRangeSnapshot={version:1;from:string;to:string;rows:PortfolioSnapshotRow[]};
export type PortfolioRangeSnapshotRecord={key:string;value:PortfolioRangeSnapshot};
export type PortfolioAggregateRow={affiliate_id:string;affiliate_name:string;offer_id:string;offer_name:string;campaign_id:string;campaign_name:string;offer_url_id:string;offer_url_name:string;clicks:number;sois:number;first_sales:number;rebills:number;coin_spend:number;payout:number;revenue:number;profit:number};

export function buildPortfolioRangeSnapshotRecordFromAggregates(from:string,to:string,rows:PortfolioAggregateRow[]):PortfolioRangeSnapshotRecord{
 return{key:`portfolio_range:${from}:${to}`,value:{version:1,from,to,rows:rows.map(row=>({a:row.affiliate_id,an:row.affiliate_name,o:row.offer_id,on:row.offer_name,c:row.campaign_id,cn:row.campaign_name,u:row.offer_url_id,un:row.offer_url_name,s:'',ss:'',cl:row.clicks,cv:row.sois,fs:row.first_sales,rb:row.rebills,cs:row.coin_spend,p:row.payout,r:row.revenue,pr:row.profit}))}};
}

function aggregateRange(rows:DailyMetricRow[],from:string,to:string){
 const grouped=new Map<string,DailyMetricRow>();
 for(const row of rows){
  if(row.metric_date<from||row.metric_date>to)continue;
  const key=[row.affiliate_id,row.offer_id,row.campaign_id,row.offer_url_id].join('\u0000');
  const current=grouped.get(key)||{...row,id:key,metric_date:to,source_id:'',sub_source:'',clicks:0,sois:0,first_sales:0,rebills:0,coin_spend:0,payout:0,revenue:0,profit:0,raw:{}};
  for(const metric of metrics)current[metric]+=row[metric];
  grouped.set(key,current);
 }
 return Array.from(grouped.values()).map(encodePortfolioSnapshotRow);
}

export function buildPortfolioRangeSnapshotRecords(from:string,to:string,rows:DailyMetricRow[]):PortfolioRangeSnapshotRecord[]{
 const ranges=new Map<string,{from:string;to:string}>(),add=(rangeFrom:string,rangeTo:string)=>ranges.set(`${rangeFrom}:${rangeTo}`,{from:rangeFrom,to:rangeTo});
 add(from,to);
 const count=dayCount(from,to);
 if(count>=7)add(shift(to,-6),to);
 add(to,to);
 return Array.from(ranges.values()).map(range=>({key:`portfolio_range:${range.from}:${range.to}`,value:{version:1,...range,rows:aggregateRange(rows,range.from,range.to)}}));
}
