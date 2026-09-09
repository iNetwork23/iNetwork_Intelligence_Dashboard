import {describe,expect,it,vi} from 'vitest';
import {refreshLongPortfolioRangeSnapshots} from './supabase-reporting';
import {reportingDays} from './berlin-reporting-contract';
function database(fromDay='2026-05-12',failure?:string){
 const published:Array<{key:string;value:Record<string,unknown>}>=[],reads:string[]=[];
 const row={affiliate_id:'10',affiliate_name:'Partner',offer_id:'20',offer_name:'Offer',campaign_id:'0',campaign_name:'Direct',offer_url_id:'30',offer_url_name:'LP',clicks:10,sois:1,first_sales:0,rebills:1,coin_spend:2,payout:3,revenue:5,profit:2,traffic_mode:'tracked'};
 const compact={a:'10',an:'Partner',o:'20',on:'Offer',c:'0',cn:'Direct',u:'30',un:'LP',s:'',ss:'',m:'tracked',cl:10,cv:1,fs:0,rb:1,cs:2,p:3,r:5,pr:2};
 const from=vi.fn((table:string)=>{
  let low='',high='',day='',keys:string[]|undefined;
  const q={select:()=>q,gte:(_column:string,value:string)=>{low=value;return q},lte:(_column:string,value:string)=>{high=value;return q},eq:(_column:string,value:string)=>{day=value;return q},order:()=>q,like:()=>q,in:(_column:string,value:string[])=>{keys=value;return q},
   upsert:async(records:typeof published)=>{published.push(...records);return{error:null}},
   range:async()=>{if(table==='daily_metrics'){reads.push(day);return{data:[row],error:null}}return{data:[],error:null}},
   then:(resolve:(value:unknown)=>unknown)=>{if(failure)return resolve({data:null,error:{message:failure}});if(keys)return resolve({data:keys.map(()=>({value:{rows:[compact]}})),error:null});const first=low.slice('portfolio_day_generation:'.length),last=high.slice('portfolio_day_generation:'.length);return resolve({data:reportingDays(first,last).filter(day=>day>=fromDay).map(date=>({value:{date,version:5,timezoneId:56,generation:'day'}})),error:null})},
  };return q;
 });return{client:{from,rpc:vi.fn()} as never,published,reads};
}
describe('background ranges with incomplete annual coverage',()=>{
 it('publishes complete 7/30/90-day ranges even while the annual import is incomplete',async()=>{
  const db=database(),result=await refreshLongPortfolioRangeSnapshots(db.client,new Date('2026-09-09T09:00:00Z'));
  expect(result).toMatchObject({incompleteRanges:[{period:'all',from:'2025-09-10',to:'2026-09-09',confirmedDays:121,totalDays:365}]});
  expect(db.published.filter(row=>row.key.startsWith('portfolio_range_generation:')).map(row=>[row.value.from,row.value.to])).toEqual([['2026-09-03','2026-09-09'],['2026-08-11','2026-09-09'],['2026-06-12','2026-09-09']]);
  const snapshots=db.published.filter(row=>row.key.startsWith('portfolio_range:'));
  expect(snapshots.map(row=>(row.value.rows as Array<{cv:number}>)[0].cv)).toEqual([7,30,90]);
  expect(db.reads.every(day=>day>='2026-06-12')).toBe(true);
 });
 it('publishes nothing and names every missing range when no day is confirmed',async()=>{
  const db=database('2026-09-10'),result=await refreshLongPortfolioRangeSnapshots(db.client,new Date('2026-09-09T09:00:00Z'));
  expect(result).toMatchObject({snapshots:[],incompleteRanges:[{period:'7d'},{period:'30d'},{period:'90d'},{period:'all'}]});expect(db.published).toEqual([]);expect(db.reads).toEqual([]);
 });
 it('keeps database failures fatal instead of treating them as missing coverage',async()=>{
  const db=database('2026-05-12','database unavailable');await expect(refreshLongPortfolioRangeSnapshots(db.client,new Date('2026-09-09T09:00:00Z'))).rejects.toThrow('database unavailable');expect(db.published).toEqual([]);
 });
});
