import {describe,expect,it,vi,beforeEach} from 'vitest';
import type {Metrics,PathRow,Portfolio} from './portfolio';

const m=(x:Partial<Metrics>):Metrics=>({clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,payout:0,revenue:0,profit:0,profitEpc:0,...x});
const path=(urlId:string,x:Partial<Metrics>):PathRow=>({...m(x),key:`20|154|0|${urlId}`,offerId:'20',offer:'Offer 20',affiliateId:'154',affiliate:'Partner 154',campaignId:'0',campaign:'Direkt',offerUrlId:urlId,offerUrl:`URL ${urlId}`,trafficType:'Direkt'});
const portfolio=(paths:PathRow[]):Portfolio=>({range:{from:'2026-08-01',to:'2026-08-30',label:'T'},totals:m({}),offers:[],affiliates:[],paths,generatedAt:'2026-08-30T12:00:00Z'});

const getDashboard=vi.fn();
vi.mock('next/cache',()=>({unstable_cache:(load:()=>unknown)=>load}));
vi.mock('./dashboard-service',()=>({getDashboard:(...a:unknown[])=>getDashboard(...a)}));

const access={role:'admin',status:'active',grants:[],denials:[],scopes:{affiliate:[],offer:[],campaign:[],account:[],source:[],sub_source:[]},version:1} as never;

describe('getAffiliateOptimizationsWithTrend',()=>{
  beforeEach(()=>{getDashboard.mockReset()});

  it('loads the preceding equally long window and attaches a verdict',async()=>{
    const {getAffiliateOptimizationsWithTrend}=await import('./affiliate-optimizer-service');
    getDashboard
      .mockResolvedValueOnce(portfolio([path('1',{clicks:400,sois:40,profit:300}),path('2',{clicks:400,sois:40,profit:50})]))
      .mockResolvedValueOnce(portfolio([path('1',{clicks:400,sois:40,profit:100}),path('2',{clicks:400,sois:40,profit:50})]));
    const result=await getAffiliateOptimizationsWithTrend('custom',{from:'2026-08-01',to:'2026-08-30'},access,{from:'2026-08-01',to:'2026-08-30'});
    expect(getDashboard).toHaveBeenNthCalledWith(2,'custom',{from:'2026-07-02',to:'2026-07-31'},access);
    const first=result[0].variants.find(v=>v.offerUrlId==='1');
    expect(first?.trendVerdict).toMatchObject({status:'ok',profitDelta:200,direction:'steigend'});
    expect(result[0].variants.find(v=>v.offerUrlId==='2')?.trendVerdict).toMatchObject({status:'ok',profitDelta:0,direction:'stabil'});
  });

  it('skips the comparison window for the 365 day period',async()=>{
    const {getAffiliateOptimizationsWithTrend}=await import('./affiliate-optimizer-service');
    getDashboard.mockResolvedValueOnce(portfolio([path('1',{clicks:400,sois:40,profit:300}),path('2',{clicks:400,sois:40,profit:50})]));
    const result=await getAffiliateOptimizationsWithTrend('all',undefined,access,{from:'2025-08-24',to:'2026-08-23'});
    expect(getDashboard).toHaveBeenCalledTimes(1);
    for(const v of result[0].variants)
      expect(v.trendVerdict).toEqual({status:'insufficient',reason:'Kein Vergleichszeitraum in der 365-Tage-Historie'});
  });
});
