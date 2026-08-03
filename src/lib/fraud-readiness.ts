import type {FraudSourceEvaluation} from './fraud-control';

type BackfillCoverage={phase?:string|null;coveredFrom?:string|null;coveredThrough?:string|null;parityVerifiedThrough?:string|null}|null;
export function fraudCutoverCoverage(backfill:BackfillCoverage,range:{from:string;to:string},activeStopDays:string[]){
  const requiredFrom=[range.from,...activeStopDays].sort()[0],ready=backfill?.phase==='rolling'&&Boolean(backfill.coveredFrom&&backfill.coveredThrough&&backfill.parityVerifiedThrough)&&backfill.coveredFrom!<=requiredFrom&&backfill.coveredThrough!>=range.to&&backfill.parityVerifiedThrough!>=range.to;
  return{requiredFrom,ready:Boolean(ready)};
}

export function applyFraudSourceCompleteness(evaluations:FraudSourceEvaluation[],sourceComplete:boolean){
  const safe=sourceComplete?evaluations:evaluations.map(row=>({...row,fraudScore:0,qualityScore:0,riskLevel:'unbekannt' as const,reasons:[],dataWarnings:[...row.dataWarnings,'Source-Zeitraum unvollständig · Score unbekannt']}));
  return{evaluations:safe,highRisk:sourceComplete?safe.filter(row=>row.riskLevel==='hohes_risiko').length:null,suspicious:sourceComplete?safe.filter(row=>row.riskLevel==='verdächtig').length:null};
}
