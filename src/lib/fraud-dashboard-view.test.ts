import {expect,it} from 'vitest';
import {compareFraudEvaluations,evaluateFraudSources,type FraudMetricInput} from './fraud-control';
import {selectFraudDashboardView} from './fraud-dashboard-view';
import {applyFraudSourceCompleteness} from './fraud-readiness';
import {fraudRowBlockState,isFraudRowOpen} from './fraud-block-row';
import {sourceRowBlockKeys,type SourceBlockMarkerIndex} from './source-block-markers';

const metric:FraudMetricInput={date:'2026-09-01',affiliateId:'1',affiliateName:'Partner',offerId:'50',offerName:'Offer',campaignId:'0',campaignName:'Direct',offerUrlId:'5',offerUrlName:'LP',trafficMode:'tracked_direct',source:'src',subSource:'leaf',sourceDimension:'source_id',subSourceDimension:'sub1',clicks:2,sois:1,firstSales:0,rebills:0,coinEvents:0,payout:1,revenue:2};
const seed=evaluateFraudSources({metrics:[metric],conversions:[],baselines:{}})[0];
const rows=Array.from({length:1_200},(_,i)=>({...seed,key:`path-${String(i).padStart(4,'0')}`,affiliateId:String(i%3+1),offerId:String(i%4+50),source:`src-${i%7}`,trafficMode:i%2?'tracked_direct' as const:'clickless_api' as const,fraudScore:i%100,qualityScore:i%60,riskLevel:i%3?'hohes_risiko' as const:'verdächtig' as const}));

it('matches the complete legacy sort/filter/slice for complete and partial coverage, including ties',()=>{
 for(const complete of [true,false]){
  const expected=applyFraudSourceCompleteness([...rows].sort(compareFraudEvaluations),complete);
  for(const filters of [{},{mode:'tracked_direct',q:'src-3'},{risk:'unbekannt'},{risk:'hohes_risiko'}]){
   const matching=expected.evaluations.filter(row=>(!filters.mode||row.trafficMode===filters.mode)&&(!filters.q||row.source.includes(filters.q))&&(!filters.risk||row.riskLevel===filters.risk));
   const actual=selectFraudDashboardView(rows.values(),complete,filters);
   expect(actual.evaluations).toEqual(matching.slice(0,250));
   expect(actual.filteredSources).toBe(matching.length);
   expect(actual.totals).toEqual({affiliates:3,offers:4,sources:1200,highRisk:expected.highRisk,suspicious:expected.suspicious});
  }
 }
});

it('applies active/pending block filters before limiting, but preserves rows when the block index is unavailable',()=>{
 const markers:SourceBlockMarkerIndex={};
 for(const row of rows){if(row.trafficMode!=='tracked_direct'||row.source!=='src-3')continue;const key=sourceRowBlockKeys({affiliateId:row.affiliateId,offerId:row.offerId,trafficMode:'tracked',mainValue:row.source,subValue:row.subSource})[0];markers[key]={id:'block',affiliateId:row.affiliateId,offerId:row.offerId,status:'active',effectiveAt:'2026-09-01T00:00:00Z'}}
 const matching=[...rows].sort(compareFraudEvaluations).filter(row=>isFraudRowOpen(fraudRowBlockState(row,markers)));
 expect(matching.length).toBeLessThan(rows.length);
 expect(selectFraudDashboardView(rows,true,{blocked:'open'},markers).evaluations).toEqual(matching.slice(0,250));
 expect(selectFraudDashboardView(rows,true,{blocked:'open'}).filteredSources).toBe(rows.length);
});

it('consumes 100000 distinct paths while retaining 250 rows and exact overall counts',()=>{
 let consumed=0;
 function* stream(){for(let i=0;i<100_000;i++){consumed++;yield{...seed,key:`path-${String(i).padStart(6,'0')}`,source:`source-${i}`,fraudScore:i%100}}}
 const result=selectFraudDashboardView(stream(),false,{q:'source-999'});
 expect(consumed).toBe(100_000);
 expect(result.totals.sources).toBe(100_000);
 expect(result.filteredSources).toBe(111);
 expect(result.evaluations).toHaveLength(111);
 expect(result.evaluations.every(row=>row.riskLevel==='unbekannt'&&row.fraudScore===0&&row.qualityScore===0)).toBe(true);
});
