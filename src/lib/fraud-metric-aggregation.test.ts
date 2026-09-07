import {expect,it} from 'vitest';
import {accumulateFraudMetric,evaluateFraudSources,type FraudMetricInput} from './fraud-control';

const metric=(index:number):FraudMetricInput=>({date:`2026-08-${String(index%28+1).padStart(2,'0')}`,affiliateId:String(index%2+1),affiliateName:'Partner',offerId:'50',offerName:'Offer',campaignId:'0',campaignName:'Direct',offerUrlId:'3',offerUrlName:'LP',trafficMode:'tracked_direct',source:'source',subSource:'leaf',sourceDimension:'source_id',subSourceDimension:'sub3',attributionPath:JSON.stringify(['source_id','source','sub1',String(index%8),'sub3','leaf']),clicks:2,sois:1,firstSales:0,rebills:0,coinEvents:0,payout:1,revenue:2});

it('keeps evaluation output identical while compacting 50000 dated rows to their eight exact paths',()=>{
 const original=Array.from({length:50_000},(_,index)=>metric(index)),groups=new Map<string,FraudMetricInput>();
 for(const row of original)accumulateFraudMetric(groups,row);
 expect(groups.size).toBe(8);
 const context={conversions:[],baselines:{'50':.03},now:new Date('2026-09-07T00:00:00Z')};
 expect(evaluateFraudSources({...context,metrics:[...groups.values()]})).toEqual(evaluateFraudSources({...context,metrics:original}));
 expect(original[0].sois).toBe(1);
 expect([...groups.values()].reduce((sum,row)=>sum+row.sois,0)).toBe(50_000);
});

it('never merges offer, campaign, landing page, traffic mode, affiliate or full attribution paths',()=>{
 const seed=metric(0),groups=new Map<string,FraudMetricInput>();
 const rows=[seed,{...seed,affiliateId:'other'},{...seed,offerId:'other'},{...seed,campaignId:'other'},{...seed,offerUrlId:'other'},{...seed,trafficMode:'clickless_api' as const},{...seed,attributionPath:'another-path'}];
 for(const row of rows)accumulateFraudMetric(groups,row);
 expect(groups.size).toBe(rows.length);
});
