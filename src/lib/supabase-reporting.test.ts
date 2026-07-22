import {describe,expect,it,vi} from 'vitest';
import {loadPortfolioFromCache,reportingRange} from './supabase-reporting';

describe('Supabase reporting periods',()=>{
  const now=new Date('2026-07-22T12:00:00Z');
  it('supports 90 days, 12 months, all history and a custom range',()=>{
    expect(reportingRange('90d',now)).toMatchObject({from:'2026-04-24',to:'2026-07-22'});
    expect(reportingRange('12m',now)).toMatchObject({from:'2025-07-23',to:'2026-07-22'});
    expect(reportingRange('all',now)).toMatchObject({from:null,to:'2026-07-22'});
    expect(reportingRange('custom',now,{from:'2024-01-03',to:'2024-02-04'})).toMatchObject({from:'2024-01-03',to:'2024-02-04'});
  });
});

describe('portfolio cache adapter',()=>{
  it('loads aggregated facts through the Postgres RPC and preserves existing KPI aggregation',async()=>{
    const rpc=vi.fn().mockResolvedValue({data:[{affiliate_id:'6',affiliate_name:'Partner',offer_id:'57',offer_name:'Offer',campaign_id:'2',campaign_name:'Campaign',offer_url_id:'2774',offer_url_name:'LP',clicks:100,sois:10,first_sales:2,rebills:3,coin_spend:4,payout:30,revenue:80,profit:50}],error:null});
    const result=await loadPortfolioFromCache('90d',{rpc} as never,new Date('2026-07-22T12:00:00Z'));
    expect(rpc).toHaveBeenCalledWith('portfolio_metric_rows',{p_from:'2026-04-24',p_to:'2026-07-22'});
    expect(result.totals).toMatchObject({clicks:100,sois:10,firstSales:2,rebills:3,coinSpend:4,revenue:80,payout:30,profit:50,cvr:10,firstSaleRate:20});
  });
});
