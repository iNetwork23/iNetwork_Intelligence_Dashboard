import {describe,expect,it,vi} from 'vitest';
import {aggregateExportRowsByMonth,buildDailyMetricsExportPageQuery,buildDailyMetricsExportQuery,EXPORT_ROW_LIMIT,exportTruncated,exportTruncationNotice,loadMonthlyExportRows,parseExportGranularity} from './export-query';

describe('daily metrics export query adapter',()=>{
 it('uses the existing schema names and never selects the nonexistent account column',()=>{
  const calls:string[]=[];const query={select:vi.fn((columns:string)=>{calls.push(columns);return query}),order:vi.fn(()=>query),limit:vi.fn(()=>query),gte:vi.fn(()=>query),lte:vi.fn(()=>query),eq:vi.fn(()=>query),in:vi.fn(()=>query)};
  buildDailyMetricsExportQuery({from:vi.fn(()=>query)} as never,{from:'2026-01-01',source:'newsletter'});
  expect(calls[0]).toContain('metric_date');expect(calls[0]).toContain('source_id');expect(calls[0]).not.toMatch(/\bday\b|account_id|\bsource\b/);
  expect(query.gte).toHaveBeenCalledWith('metric_date','2026-01-01');expect(query.eq).toHaveBeenCalledWith('source_id','newsletter');
 });
});

type Page={data:unknown[]|null;error:{message:string}|null;count:number|null};
type MockQuery={select:ReturnType<typeof vi.fn>;order:ReturnType<typeof vi.fn>;limit:ReturnType<typeof vi.fn>;range:ReturnType<typeof vi.fn>;gte:ReturnType<typeof vi.fn>;lte:ReturnType<typeof vi.fn>;eq:ReturnType<typeof vi.fn>;in:ReturnType<typeof vi.fn>;then?:(resolve:(value:Page)=>unknown)=>Promise<unknown>};
/** Chainbarer Query-Mock; mit page() wird range(from,to) zur Seite aufgelöst (PromiseLike). */
const mockQuery=(page?:(from:number,to:number)=>Page)=>{const query:MockQuery={select:vi.fn<(...args:unknown[])=>MockQuery>(()=>query),order:vi.fn<(...args:unknown[])=>MockQuery>(()=>query),limit:vi.fn<(...args:unknown[])=>MockQuery>(()=>query),range:vi.fn((from:number,to:number)=>{if(page){const result=page(from,to);query.then=resolve=>Promise.resolve(result).then(resolve)}return query}),gte:vi.fn<(...args:unknown[])=>MockQuery>(()=>query),lte:vi.fn<(...args:unknown[])=>MockQuery>(()=>query),eq:vi.fn<(...args:unknown[])=>MockQuery>(()=>query),in:vi.fn<(...args:unknown[])=>MockQuery>(()=>query)};return query};
const pagedClient=(page:(from:number,to:number)=>Page)=>({from:vi.fn(()=>mockQuery(page))});
const daily=(metric_date:string,affiliate_id:string,offer_id:string,numbers:Partial<Record<'clicks'|'sois'|'first_sales'|'rebills'|'coin_spend'|'payout'|'revenue'|'profit',number>>={})=>({metric_date,affiliate_id,affiliate_name:`Partner ${affiliate_id}`,offer_id,offer_name:`Offer ${offer_id}`,campaign_id:'1',campaign_name:'C',offer_url_id:'9',offer_url_name:'LP',source_id:'src',sub_source:'',clicks:0,sois:0,first_sales:0,rebills:0,coin_spend:0,payout:0,revenue:0,profit:0,...numbers});

describe('export truncation (Etappe 4)',()=>{
 it('requests an exact count and a stable order so the cap is detectable and pages never overlap',()=>{
  const query=mockQuery();buildDailyMetricsExportQuery({from:vi.fn(()=>query)} as never,{});
  expect(query.select).toHaveBeenCalledWith(expect.any(String),{count:'exact'});expect(query.limit).toHaveBeenCalledWith(EXPORT_ROW_LIMIT);
  expect(query.order.mock.calls[0]).toEqual(['metric_date',{ascending:false}]);expect(query.order.mock.calls.map(call=>call[0])).toContain('sub_source');
 });
 it('flags the Supabase max-rows cap via the exact count and falls back to the own limit without a count',()=>{
  const rows=Array.from({length:1000},(_,index)=>daily('2026-08-01',String(index),'1'));
  expect(exportTruncated({data:rows,count:1000})).toBe(false);expect(exportTruncated({data:rows,count:4321})).toBe(true);
  expect(exportTruncated({data:rows,count:null})).toBe(false);expect(exportTruncated({data:rows,count:null},1000)).toBe(true);
  expect(exportTruncated({data:[],count:0})).toBe(false);
 });
 it('states the cap and both remedies in the CSV header line',()=>{expect(exportTruncationNotice(1000)).toBe('# gekappt bei 1000 Zeilen – Zeitraum verkleinern oder granularity=month nutzen')});
 it('accepts only day (default) or month as granularity',()=>{expect(parseExportGranularity(null)).toBe('day');expect(parseExportGranularity('')).toBe('day');expect(parseExportGranularity('day')).toBe('day');expect(parseExportGranularity('month')).toBe('month');expect(parseExportGranularity('week')).toBeNull()});
});

describe('monthly export aggregate (Etappe 4)',()=>{
 it('sums every numeric field per month and dimension, replaces metric_date by metric_month and sorts month desc',()=>{
  const rows=aggregateExportRowsByMonth([daily('2026-08-03','30','25',{clicks:10,sois:2,payout:6,revenue:1.005,profit:-4.995}),daily('2026-08-20','30','25',{clicks:5,sois:1,first_sales:1,rebills:2,coin_spend:0.5,payout:3,revenue:20,profit:17}),daily('2026-08-20','30','26',{clicks:1}),daily('2026-07-31','30','25',{clicks:7,sois:7}),{...daily('2026-08-01','31','25'),clicks:'4',sois:'1'}]);
  expect(rows.map(row=>[row.metric_month,row.affiliate_id,row.offer_id])).toEqual([['2026-08','30','25'],['2026-08','30','26'],['2026-08','31','25'],['2026-07','30','25']]);
  expect(rows[0]).toMatchObject({metric_month:'2026-08',affiliate_name:'Partner 30',offer_name:'Offer 25',clicks:15,sois:3,first_sales:1,rebills:2,coin_spend:0.5,payout:9,revenue:21.01,profit:12.01});
  expect(rows[0]).not.toHaveProperty('metric_date');expect(rows[2]).toMatchObject({clicks:4,sois:1});expect(rows[3]).toMatchObject({clicks:7,sois:7});
 });
 it('skips rows without a valid metric_date',()=>{expect(aggregateExportRowsByMonth([{...daily('2026-08-01','1','1'),metric_date:null},{...daily('2026-08-01','1','1'),metric_date:'heute'}])).toEqual([])});
 it('builds a page query with range instead of limit and the same filters and scopes',()=>{
  const query=mockQuery();buildDailyMetricsExportPageQuery({from:vi.fn(()=>query)} as never,{from:'2026-08-01',to:'2026-08-31',offer:'25'},{affiliate:['30']},{offset:2000,size:1000});
  expect(query.range).toHaveBeenCalledWith(2000,2999);expect(query.limit).not.toHaveBeenCalled();expect(query.gte).toHaveBeenCalledWith('metric_date','2026-08-01');expect(query.lte).toHaveBeenCalledWith('metric_date','2026-08-31');expect(query.eq).toHaveBeenCalledWith('offer_id','25');expect(query.in).toHaveBeenCalledWith('affiliate_id',['30']);
 });
 it('pages through the daily rows until the exact count is reached and aggregates them',async()=>{
  const all=[...Array.from({length:3},(_,index)=>daily(`2026-08-0${index+1}`,'30','25',{clicks:1,sois:1,payout:3})),...Array.from({length:2},(_,index)=>daily(`2026-07-0${index+1}`,'30','25',{clicks:2}))],ranges:Array<[number,number]>=[];
  const client=pagedClient((from,to)=>{ranges.push([from,to]);return{data:all.slice(from,to+1),error:null,count:all.length}});
  const result=await loadMonthlyExportRows(client as never,{},undefined,{pageSize:2,maxRows:100});
  expect(ranges).toEqual([[0,1],[2,3],[4,5]]);expect(result.truncated).toBe(false);expect(result.dailyRows).toBe(5);expect(result.error).toBeNull();
  expect(result.rows).toEqual([expect.objectContaining({metric_month:'2026-08',clicks:3,sois:3,payout:9}),expect.objectContaining({metric_month:'2026-07',clicks:4,sois:0})]);
 });
 it('stops at the row budget and reports truncation when more rows exist',async()=>{
  const all=Array.from({length:10},(_,index)=>daily(`2026-08-${String(index+1).padStart(2,'0')}`,'30','25',{clicks:1}));
  const client=pagedClient((from,to)=>({data:all.slice(from,to+1),error:null,count:all.length}));
  const result=await loadMonthlyExportRows(client as never,{},undefined,{pageSize:3,maxRows:6});
  expect(result.dailyRows).toBe(6);expect(result.truncated).toBe(true);expect(result.rows).toEqual([expect.objectContaining({metric_month:'2026-08',clicks:6})]);
 });
 it('keeps paging by the delivered page length when Supabase max-rows is smaller than the page size',async()=>{
  const all=Array.from({length:7},(_,index)=>daily(`2026-08-${String(index+1).padStart(2,'0')}`,'30','25',{clicks:1})),ranges:Array<[number,number]>=[];
  const client=pagedClient((from,to)=>{ranges.push([from,to]);return{data:all.slice(from,Math.min(to+1,from+3)),error:null,count:all.length}});
  const result=await loadMonthlyExportRows(client as never,{},undefined,{pageSize:5,maxRows:100});
  expect(ranges).toEqual([[0,4],[3,7],[6,10]]);expect(result.dailyRows).toBe(7);expect(result.truncated).toBe(false);expect(result.rows).toEqual([expect.objectContaining({metric_month:'2026-08',clicks:7})]);
 });
 it('surfaces a Supabase error instead of a partial aggregate',async()=>{
  const client=pagedClient(()=>({data:null,error:{message:'down'},count:null}));
  const result=await loadMonthlyExportRows(client as never,{});
  expect(result).toEqual({rows:[],error:{message:'down'},truncated:false,dailyRows:0});
 });
});
