import{describe,expect,it}from'vitest';
import{buildPortfolioRangeSnapshotRecords}from'./portfolio-range-snapshots';
import type{DailyMetricRow}from'./history-cache';

const row=(date:string,clicks:number):DailyMetricRow=>({id:`metric:${date}`,metric_date:date,affiliate_id:'6',affiliate_name:'Partner',offer_id:'57',offer_name:'Offer',campaign_id:'0',campaign_name:'Direct',offer_url_id:'2774',offer_url_name:'LP',source_id:'source',sub_source:'sub',clicks,sois:1,first_sales:1,rebills:0,coin_spend:0,payout:2,revenue:5,profit:3,raw:{}});
const shift=(day:string,count:number)=>new Date(Date.parse(`${day}T12:00:00Z`)+count*86_400_000).toISOString().slice(0,10);

describe('portfolio range snapshots',()=>{
 it('pre-aggregates the exact rolling range plus today and seven days for one-row reads',()=>{
  const from='2026-06-23',to='2026-07-22',rows=Array.from({length:30},(_,index)=>row(shift(from,index),index+1));
  const records=buildPortfolioRangeSnapshotRecords(from,to,rows),byKey=new Map(records.map(record=>[record.key,record.value]));
  expect([...byKey.keys()].sort()).toEqual([`portfolio_range:${from}:${to}`,'portfolio_range:2026-07-16:2026-07-22','portfolio_range:2026-07-22:2026-07-22'].sort());
  expect(byKey.get(`portfolio_range:${from}:${to}`)?.rows).toHaveLength(1);
  expect(byKey.get(`portfolio_range:${from}:${to}`)?.rows[0]).toMatchObject({cl:465,cv:30,fs:30,p:60,r:150,pr:90});
  expect(byKey.get('portfolio_range:2026-07-16:2026-07-22')?.rows[0]).toMatchObject({cl:189,cv:7});
 });
});
