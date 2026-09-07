import {compareFraudEvaluations,type FraudSourceEvaluation} from './fraud-control';
import {applyFraudSourceCompleteness} from './fraud-readiness';
import {fraudRowBlockState,isFraudRowOpen} from './fraud-block-row';
import type {SourceBlockMarkerIndex} from './source-block-markers';

export type FraudDashboardFilters={risk?:string;mode?:string;q?:string;blocked?:string};
export const FRAUD_VISIBLE_LIMIT=250;

/** Count every source, but retain only the globally best matching rows for the table. */
export function selectFraudDashboardView(evaluations:Iterable<FraudSourceEvaluation>,sourceComplete:boolean,filters:FraudDashboardFilters={},markers?:SourceBlockMarkerIndex){
  const query=(filters.q||'').trim().toLowerCase(),affiliates=new Set<string>(),offers=new Set<string>();
  const selected:{raw:FraudSourceEvaluation;row:FraudSourceEvaluation}[]=[];
  let sources=0,highRisk=0,suspicious=0,filteredSources=0;
  for(const raw of evaluations){
    const row=sourceComplete?raw:applyFraudSourceCompleteness([raw],false).evaluations[0];
    sources++;affiliates.add(row.affiliateId);offers.add(row.offerId);
    if(row.riskLevel==='hohes_risiko')highRisk++;
    if(row.riskLevel==='verdächtig')suspicious++;
    if(filters.risk&&filters.risk!=='all'&&row.riskLevel!==filters.risk)continue;
    if(filters.mode&&filters.mode!=='all'&&row.trafficMode!==filters.mode)continue;
    if(query&&![row.affiliateName,row.affiliateId,row.offerName,row.offerId,row.source,row.subSource,row.campaignName,row.offerUrlName].some(value=>value.toLowerCase().includes(query)))continue;
    if(filters.blocked==='open'&&markers&&!isFraudRowOpen(fraudRowBlockState(row,markers)))continue;
    filteredSources++;
    // Preserve the former ordering: rank before the completeness gate neutralizes scores.
    if(selected.length===FRAUD_VISIBLE_LIMIT&&compareFraudEvaluations(raw,selected.at(-1)!.raw)>=0)continue;
    let low=0,high=selected.length;
    while(low<high){const middle=(low+high)>>>1;if(compareFraudEvaluations(raw,selected[middle].raw)<0)high=middle;else low=middle+1}
    selected.splice(low,0,{raw,row});
    if(selected.length>FRAUD_VISIBLE_LIMIT)selected.pop();
  }
  return{evaluations:selected.map(item=>item.row),filteredSources,totals:{affiliates:affiliates.size,offers:offers.size,sources,highRisk:sourceComplete?highRisk:null,suspicious:sourceComplete?suspicious:null}};
}
