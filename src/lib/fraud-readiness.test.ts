import {describe,expect,it} from 'vitest';
import {applyFraudSourceCompleteness,fraudCutoverCoverage} from './fraud-readiness';
import type {FraudSourceEvaluation} from './fraud-control';

const state=(overrides:Record<string,unknown>={})=>({phase:'rolling',coveredFrom:'2026-06-01',coveredThrough:'2026-07-31',parityVerifiedThrough:'2026-07-31',...overrides});
const evaluation={fraudScore:70,qualityScore:25,riskLevel:'hohes_risiko',reasons:['signal'],dataWarnings:[]} as unknown as FraudSourceEvaluation;

describe('query-dependent fraud readiness',()=>{
  it('requires coverage from the earliest active stop through the selected range',()=>{
    expect(fraudCutoverCoverage(state({coveredFrom:'2026-07-01'}),{from:'2026-07-01',to:'2026-07-31'},['2026-06-15']).ready).toBe(false);
    expect(fraudCutoverCoverage(state({coveredThrough:'2026-07-30'}),{from:'2026-07-01',to:'2026-07-31'},['2026-06-15']).ready).toBe(false);
    expect(fraudCutoverCoverage(state({parityVerifiedThrough:'2026-07-30'}),{from:'2026-07-01',to:'2026-07-31'},['2026-06-15']).ready).toBe(false);
    expect(fraudCutoverCoverage(state(),{from:'2026-07-01',to:'2026-07-31'},['2026-06-15'])).toEqual({requiredFrom:'2026-06-15',ready:true});
  });
  it('neutralizes every period score and count when source-day history is partial',()=>{
    const result=applyFraudSourceCompleteness([evaluation],false);
    expect(result.evaluations[0]).toMatchObject({fraudScore:0,qualityScore:0,riskLevel:'unbekannt',reasons:[]});
    expect(result.evaluations[0].dataWarnings).toContain('Source-Zeitraum unvollständig · Score unbekannt');
    expect(result.highRisk).toBeNull();expect(result.suspicious).toBeNull();
  });
});
