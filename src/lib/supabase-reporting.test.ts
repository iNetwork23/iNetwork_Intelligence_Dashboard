import {describe,expect,it,vi} from 'vitest';
import {backgroundPortfolioPeriods,loadPortfolioFromCache,publishPortfolioRangeRecords,reportingRange} from './supabase-reporting';
import{buildPortfolioRangeSnapshotRecordFromAggregates}from'./portfolio-range-snapshots';
import{readFileSync}from'node:fs';import{join}from'node:path';

describe('Supabase reporting periods',()=>{
  const now=new Date('2026-07-22T12:00:00Z');
  it('supports 90 days, 12 months, all history and a custom range',()=>{
    expect(reportingRange('90d',now)).toMatchObject({from:'2026-04-24',to:'2026-07-22'});
    expect(reportingRange('12m',now)).toMatchObject({from:'2025-07-23',to:'2026-07-22'});
    expect(reportingRange('all',now)).toMatchObject({from:'2025-07-23',to:'2026-07-22'});
    expect(reportingRange('custom',now,{from:'2024-01-03',to:'2024-02-04'})).toMatchObject({from:'2024-01-03',to:'2024-02-04'});
  });
  it('refreshes every frequently used rolling range while historical backfill is still running',()=>{
    expect(backgroundPortfolioPeriods).toEqual(['7d','30d','90d','all']);
  });
});

describe('portfolio cache adapter',()=>{
  it('loads only the immutable snapshot selected by the active range marker',async()=>{
    const keys:string[]=[],from=vi.fn(()=>({select:vi.fn(()=>({eq:vi.fn((_column:string,key:string)=>({maybeSingle:vi.fn().mockImplementation(async()=>{keys.push(key);if(key==='portfolio_range_generation:2026-06-23:2026-07-22')return{data:{value:{version:2,from:'2026-06-23',to:'2026-07-22',generation:'gen-1'}},error:null};if(key==='portfolio_range:2026-06-23:2026-07-22:gen-1')return{data:{value:{version:2,from:'2026-06-23',to:'2026-07-22',generation:'gen-1',rows:[{a:'6',an:'Partner',o:'57',on:'Offer',c:'0',cn:'Direct',u:'2774',un:'LP',s:'',ss:'',cl:100,cv:10,fs:2,rb:3,cs:4,p:30,r:80,pr:50}]}},error:null};return{data:null,error:null}})}))}))}));
    const result=await loadPortfolioFromCache('30d',{from,rpc:vi.fn()} as never,new Date('2026-07-22T12:00:00Z'));
    expect(keys).toEqual(['portfolio_range_generation:2026-06-23:2026-07-22','portfolio_range:2026-06-23:2026-07-22:gen-1']);
    expect(result.totals).toMatchObject({clicks:100,sois:10,firstSales:2,rebills:3,coinSpend:4,revenue:80,payout:30,profit:50});
  });
  it('does not switch active markers when immutable snapshot writes fail',async()=>{
    const upsert=vi.fn().mockResolvedValueOnce({error:{message:'snapshot failed'}}),client={from:vi.fn(()=>({upsert}))};
    const record=buildPortfolioRangeSnapshotRecordFromAggregates('2026-06-23','2026-07-22',[]);
    await expect(publishPortfolioRangeRecords(client as never,[record],'gen-fail')).rejects.toThrow('snapshot failed');
    expect(upsert).toHaveBeenCalledTimes(1);
  });
  it('re-reads the active marker before pruning old generated rows',async()=>{
    const published='1800000000000-00000000-0000-4000-8000-000000000000',old='portfolio_range:2026-06-23:2026-07-22:1700000000000-00000000-0000-4000-8000-000000000000',upsert=vi.fn().mockResolvedValue({error:null}),maybeSingle=vi.fn().mockResolvedValue({data:{value:{generation:published}},error:null}),deleted=vi.fn().mockResolvedValue({error:null});
    const from=vi.fn(()=>({upsert,select:vi.fn((columns:string)=>columns==='key'?{like:vi.fn(()=>({order:vi.fn(()=>({range:vi.fn().mockResolvedValue({data:[{key:old}],error:null})}))}))}:{eq:vi.fn(()=>({maybeSingle}))}),delete:vi.fn(()=>({in:deleted}))}));
    const record=buildPortfolioRangeSnapshotRecordFromAggregates('2026-06-23','2026-07-22',[]);
    await publishPortfolioRangeRecords({from}as never,[record],published);
    expect(maybeSingle).toHaveBeenCalledTimes(1);
    expect(deleted).toHaveBeenCalledWith('key',[old]);
  });
  it('loads compact daily snapshots in small batches so cold JSON reads stay below the database statement timeout',()=>{const code=readFileSync(join(process.cwd(),'src/lib/supabase-reporting.ts'),'utf8');expect(code).toContain("start<keys.length;start+=5");expect(code).toContain("keys.slice(start,start+5)");expect(code).not.toContain("keys.slice(start,start+50)")});
  it('loads aggregated facts through the Postgres RPC and preserves existing KPI aggregation',async()=>{
    const rpc=vi.fn().mockResolvedValue({data:[{affiliate_id:'6',affiliate_name:'Partner',offer_id:'57',offer_name:'Offer',campaign_id:'2',campaign_name:'Campaign',offer_url_id:'2774',offer_url_name:'LP',clicks:100,sois:10,first_sales:2,rebills:3,coin_spend:4,payout:30,revenue:80,profit:50}],error:null});
    const result=await loadPortfolioFromCache('90d',{rpc} as never,new Date('2026-07-22T12:00:00Z'));
    expect(rpc).toHaveBeenCalledWith('portfolio_metric_rows',{p_from:'2026-04-24',p_to:'2026-07-22'});
    expect(result.totals).toMatchObject({clicks:100,sois:10,firstSales:2,rebills:3,coinSpend:4,revenue:80,payout:30,profit:50,cvr:10,firstSaleRate:20});
  });
});
