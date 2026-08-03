import {describe,expect,it} from 'vitest';
import {advanceFraudBackfillState,buildFraudBackfillParity,initialFraudBackfillState,invalidateFraudBackfillState,normalizeFraudBackfillState,selectFraudBackfillWindow} from './fraud-backfill';

describe('resumable fraud conversion backfill',()=>{
  const now=new Date('2026-07-30T12:00:00Z');
  it('starts a versioned 120-day backfill in bounded seven-day chunks',()=>{
    const state=initialFraudBackfillState(now),window=selectFraudBackfillWindow(state,now);
    expect(state).toMatchObject({version:3,phase:'backfill',windowFrom:'2026-04-02',windowTo:'2026-07-30',nextFrom:'2026-04-02',coveredFrom:null,coveredThrough:null,parityVerifiedThrough:null});
    expect(window).toEqual({mode:'backfill',from:'2026-04-02',to:'2026-04-08'});
  });
  it('extends initial coverage to an older active compliance stop',()=>{
    const state=initialFraudBackfillState(now,'2026-02-15');
    expect(state).toMatchObject({windowFrom:'2026-02-15',nextFrom:'2026-02-15'});
  });
  it('advances only after a successful chunk and reaches a ready cutover',()=>{
    let state=initialFraudBackfillState(now);
    const parity=(from:string,to:string)=>({from,to,expected:{soi:1,coin_spend:0,first_sale:0,rebill:0},stored:{soi:1,coin_spend:0,first_sale:0,rebill:0},expectedDigest:'authoritative-events',storedDigest:'authoritative-events',reportHasActivity:true,verified:true});
    state=advanceFraudBackfillState(state,{mode:'backfill',from:'2026-04-02',to:'2026-04-08'},now,parity('2026-04-02','2026-04-08'));
    expect(state.nextFrom).toBe('2026-04-09');
    expect(state.parityVerifiedThrough).toBe('2026-04-08');
    while(state.phase==='backfill'){const window=selectFraudBackfillWindow(state,now);state=advanceFraudBackfillState(state,window,now,parity(window.from,window.to))}
    expect(state).toMatchObject({phase:'rolling',nextFrom:'2026-07-31',readyAt:'2026-07-30T12:00:00.000Z',parityVerifiedThrough:'2026-07-30'});
  });
  it('refuses to advance when persisted type counts do not match the provider window',()=>{
    const state=initialFraudBackfillState(now),window=selectFraudBackfillWindow(state,now);
    expect(()=>advanceFraudBackfillState(state,window,now,{from:window.from,to:window.to,expected:{soi:1,coin_spend:0,first_sale:0,rebill:0},stored:{soi:0,coin_spend:0,first_sale:0,rebill:0},expectedDigest:'provider',storedDigest:'stored',reportHasActivity:true,verified:false})).toThrow('Parity');
  });
  it('requires exact provider and stored event identities, not only equal type counts',()=>{
    const counts={soi:1,coin_spend:1,first_sale:0,rebill:0};
    expect(buildFraudBackfillParity({from:'2026-07-01',to:'2026-07-07',expected:{typeCounts:counts,identityDigest:'provider-events'},stored:{typeCounts:counts,identityDigest:'different-events'},reportHasActivity:true}).verified).toBe(false);
  });
  it('fails closed when an empty conversion feed contradicts source-report activity',()=>{
    const counts={soi:0,coin_spend:0,first_sale:0,rebill:0},evidence={typeCounts:counts,identityDigest:'empty'};
    expect(buildFraudBackfillParity({from:'2026-07-01',to:'2026-07-07',expected:evidence,stored:evidence,reportHasActivity:true}).verified).toBe(false);
    expect(buildFraudBackfillParity({from:'2026-07-01',to:'2026-07-07',expected:evidence,stored:evidence,reportHasActivity:false}).verified).toBe(true);
  });
  it('refuses to trust a legacy rolling state that has no contiguous parity evidence',()=>{
    const legacy={version:3 as const,phase:'rolling' as const,windowFrom:'2026-04-02',windowTo:'2026-07-30',nextFrom:'2026-07-31',coveredFrom:'2026-04-02',coveredThrough:'2026-07-30',readyAt:'2026-07-30T12:00:00.000Z',lastSuccessAt:'2026-07-30T12:00:00.000Z'};
    expect(normalizeFraudBackfillState(legacy)).toMatchObject({phase:'backfill',nextFrom:'2026-04-02',coveredFrom:null,coveredThrough:null,parityVerifiedThrough:null,readyAt:null});
  });
  it('refuses a v3 rolling state whose last parity has only count evidence',()=>{
    const weak={...initialFraudBackfillState(now),phase:'rolling' as const,nextFrom:'2026-07-31',coveredFrom:'2026-04-02',coveredThrough:'2026-07-30',parityVerifiedThrough:'2026-07-30',readyAt:'2026-07-30T12:00:00.000Z',lastParity:{from:'2026-07-24',to:'2026-07-30',expected:{soi:1,coin_spend:0,first_sale:0,rebill:0},stored:{soi:1,coin_spend:0,first_sale:0,rebill:0},verified:true}};
    expect(normalizeFraudBackfillState(weak as unknown as Parameters<typeof normalizeFraudBackfillState>[0])).toMatchObject({phase:'backfill',coveredFrom:null,coveredThrough:null,parityVerifiedThrough:null,readyAt:null});
  });
  it('uses contiguous catch-up windows when rolling starts days after the initial cutoff',()=>{
    const parity=(from:string,to:string)=>({from,to,expected:{soi:1,coin_spend:0,first_sale:0,rebill:0},stored:{soi:1,coin_spend:0,first_sale:0,rebill:0},expectedDigest:'authoritative-events',storedDigest:'authoritative-events',reportHasActivity:true,verified:true});
    let state=initialFraudBackfillState(now);
    while(state.phase==='backfill'){const window=selectFraudBackfillWindow(state,now);state=advanceFraudBackfillState(state,window,now,parity(window.from,window.to))}
    const delayed=new Date('2026-08-10T12:00:00Z'),first=selectFraudBackfillWindow(state,delayed);
    expect(first).toEqual({mode:'rolling',from:'2026-07-31',to:'2026-08-06'});
    state=advanceFraudBackfillState(state,first,delayed,parity(first.from,first.to));
    expect(selectFraudBackfillWindow(state,delayed)).toEqual({mode:'rolling',from:'2026-08-07',to:'2026-08-10'});
    expect(state.coveredThrough).toBe('2026-08-06');
    expect(state.parityVerifiedThrough).toBe('2026-08-06');
  });
  it('uses a three-day repair window after cutover when coverage is already current',()=>{
    const state={...initialFraudBackfillState(now),phase:'rolling' as const,nextFrom:'2026-07-31',coveredFrom:'2026-04-02',coveredThrough:'2026-07-30',parityVerifiedThrough:'2026-07-30',readyAt:'2026-07-30T10:00:00.000Z'};
    expect(selectFraudBackfillWindow(state,now)).toEqual({mode:'rolling',from:'2026-07-28',to:'2026-07-30'});
  });
  it('invalidates an existing cutover before an authoritative repair starts',()=>{
    const ready={...initialFraudBackfillState(now),phase:'rolling' as const,coveredFrom:'2026-04-02',coveredThrough:'2026-07-30',parityVerifiedThrough:'2026-07-30',readyAt:'2026-07-30T10:00:00.000Z',lastParity:{from:'2026-07-28',to:'2026-07-30',expected:{soi:1,coin_spend:0,first_sale:0,rebill:0},stored:{soi:1,coin_spend:0,first_sale:0,rebill:0},expectedDigest:'same',storedDigest:'same',reportHasActivity:true,verified:true}};
    expect(invalidateFraudBackfillState(ready)).toMatchObject({phase:'rolling',readyAt:null,parityVerifiedThrough:null,lastParity:null});
  });
});
