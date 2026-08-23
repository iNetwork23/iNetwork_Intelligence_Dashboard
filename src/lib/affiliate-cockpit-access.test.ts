import {describe,expect,it,vi} from 'vitest';

vi.mock('./dashboard-service',()=>({getDashboard:async()=>({range:{from:'',to:'',label:''},totals:{},offers:[],affiliates:[],paths:[],generatedAt:''})}));

describe('cockpit access boundary',()=>{
  it('refuses aggregate access for a partner role',async()=>{
    const {getAffiliateOptimizationsWithTrend}=await import('./affiliate-optimizer-service');
    const partner={role:'partner',affiliateIds:['154']} as never;
    await expect(getAffiliateOptimizationsWithTrend('30d',undefined,partner,{from:'2026-08-01',to:'2026-08-30'})).rejects.toThrow();
  });
  it('keeps the service guarded by the aggregate assertion',async()=>{
    const {readFileSync}=await import('node:fs');
    const source=readFileSync('src/lib/affiliate-optimizer-service.ts','utf8');
    expect(source).toContain('assertAffiliateOptimizerAggregateAccess(access)');
  });
});
