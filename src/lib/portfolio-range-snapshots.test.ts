import{describe,expect,it}from'vitest';
import{buildPortfolioRangePublication,buildPortfolioRangeSnapshotRecordFromAggregates,buildPortfolioRangeSnapshotRecords,isPortfolioRangeSnapshotFresh,isValidPortfolioRangeSnapshot,stalePortfolioRangeSnapshotKeys}from'./portfolio-range-snapshots';
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
 it('encodes a long-range aggregate without changing any KPI total',()=>{
  const record=buildPortfolioRangeSnapshotRecordFromAggregates('2026-04-26','2026-07-24',[{
   affiliate_id:'32',affiliate_name:'WLX',offer_id:'57',offer_name:'Singles69',campaign_id:'146',campaign_name:'Global',offer_url_id:'2751',offer_url_name:'Heutenochdate',clicks:10,sois:8,first_sales:3,rebills:2,coin_spend:4,payout:5,revenue:15,profit:10,
  }]);
  expect(record.key).toBe('portfolio_range:2026-04-26:2026-07-24');
  expect(record.value.rows[0]).toMatchObject({a:'32',o:'57',c:'146',u:'2751',cl:10,cv:8,fs:3,rb:2,cs:4,p:5,r:15,pr:10});
 });
 it('rejects malformed dimensions and non-finite KPI values',()=>{
  const valid=buildPortfolioRangeSnapshotRecordFromAggregates('2026-04-26','2026-07-24',[{affiliate_id:'32',affiliate_name:'WLX',offer_id:'57',offer_name:'Singles69',campaign_id:'146',campaign_name:'Global',offer_url_id:'2751',offer_url_name:'LP',clicks:1,sois:1,first_sales:0,rebills:0,coin_spend:0,payout:1,revenue:2,profit:1}]).value;
  expect(isValidPortfolioRangeSnapshot(valid,'2026-04-26','2026-07-24')).toBe(true);
  expect(isValidPortfolioRangeSnapshot({...valid,rows:[{...valid.rows[0],a:undefined}]},'2026-04-26','2026-07-24')).toBe(false);
  expect(isValidPortfolioRangeSnapshot({...valid,rows:[{...valid.rows[0],pr:Number.NaN}]},'2026-04-26','2026-07-24')).toBe(false);
 });
 it('publishes immutable generated rows behind active range markers',()=>{
  const draft=buildPortfolioRangeSnapshotRecordFromAggregates('2026-04-26','2026-07-24',[]),publication=buildPortfolioRangePublication([draft],'gen-123');
  expect(publication.snapshots).toEqual([{key:'portfolio_range:2026-04-26:2026-07-24:gen-123',value:{...draft.value,version:2,generation:'gen-123'}}]);
  expect(publication.markers).toEqual([{key:'portfolio_range_generation:2026-04-26:2026-07-24',value:{version:2,from:'2026-04-26',to:'2026-07-24',generation:'gen-123'}}]);
 });
 it('prunes only inactive generated range rows older than the retention cutoff',()=>{
  const prefix='portfolio_range:2026-04-26:2026-07-24:',old=`${prefix}1700000000000-00000000-0000-4000-8000-000000000000`,active=`${prefix}1800000000000-00000000-0000-4000-8000-000000000000`;
  expect(stalePortfolioRangeSnapshotKeys([old,active,`${prefix}legacy`],prefix,active.slice(prefix.length),1750000000000)).toEqual([old]);
 });
 it('rejects a range generation when any participating day was refreshed later',()=>{const range='1785000000000-00000000-0000-4000-8000-000000000000',older='1784990000000-00000000-0000-4000-8000-000000000000',newer='1785010000000-00000000-0000-4000-8000-000000000000';expect(isPortfolioRangeSnapshotFresh(range,[older,range])).toBe(true);expect(isPortfolioRangeSnapshotFresh(range,[older,newer])).toBe(false);expect(isPortfolioRangeSnapshotFresh('legacy-generation',[newer])).toBe(true)});
});
