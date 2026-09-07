import {describe,expect,it,vi} from 'vitest';
import {loadAffiliateSourceRowsFromCache} from './cached-evaluations';
import {loadCampaignAffiliateRowsFromCache,loadSmartlinkInsightFromCache} from './cached-smartlinks';
import {normalizeFraudBackfillState} from './fraud-backfill';
import {activityMemoFingerprint} from './cached-evaluations';
import {deriveDataStatus} from './data-status';
import {initialSyncState} from './history-cache';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),factReads:vi.fn()}));
vi.mock('./supabase',()=>({getSupabaseAdmin:()=>({rpc:mocks.rpc,from:(table:string)=>{
 if(table!=='sync_state')mocks.factReads();
 const q={select:()=>q,gte:()=>q,lte:()=>q,order:()=>q,then:(resolve:(v:unknown)=>void)=>resolve({data:[{value:{version:4,date:'2026-07-01',generation:'old'}}],error:null})};return q;
}})}));
vi.mock('./campaign-snapshots',()=>({loadCampaignShapesFromCache:async()=>[]}));

describe('Berlin proof before legacy fact boundaries',()=>{
 it.each([
  ['source RPC',()=>loadAffiliateSourceRowsFromCache('7d','6',new Date('2026-07-01T12:00Z'))],
  ['smartlink RPC',()=>loadSmartlinkInsightFromCache(2,new Date('2026-07-01T12:00Z'))],
  ['campaign table fallback',()=>loadCampaignAffiliateRowsFromCache({from:'2026-07-01',to:'2026-07-01'})],
 ])('rejects an old proof before the %s',async(_name,load)=>{
  await expect(load()).rejects.toThrow('Berlin');expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.factReads).not.toHaveBeenCalled();
 });
 it('invalidates an activity memo when an older day is repaired even if the newest day does not change',()=>{
  const markers=[{version:5,timezoneId:56,date:'2026-07-01',generation:'old'},{version:5,timezoneId:56,date:'2026-07-02',generation:'latest'}];
  expect(activityMemoFingerprint(markers)).not.toBe(activityMemoFingerprint([{...markers[0],generation:'repaired'},markers[1]]));
 });
 it('drops old Fraud coverage even when its old type counts and event digest match',()=>{
  const old={version:3,phase:'rolling' as const,windowFrom:'2026-04-02',windowTo:'2026-07-30',nextFrom:'2026-07-31',coveredFrom:'2026-04-02',coveredThrough:'2026-07-30',parityVerifiedThrough:'2026-07-30',readyAt:'2026-07-30T12:00Z',lastSuccessAt:'2026-07-30T12:00Z',lastParity:{from:'2026-07-28',to:'2026-07-30',expected:{soi:1,coin_spend:0,first_sale:0,rebill:0},stored:{soi:1,coin_spend:0,first_sale:0,rebill:0},expectedDigest:'same',storedDigest:'same',reportHasActivity:true,verified:true}};
  expect(normalizeFraudBackfillState(old)).toMatchObject({version:4,phase:'backfill',nextFrom:'2026-04-02',readyAt:null,coveredFrom:null,coveredThrough:null,lastParity:null});
  const now=new Date('2026-07-30T12:00Z');
  expect(deriveDataStatus(initialSyncState(now),now,{fraud:old}).fraudCutoverReady).toBe(false);
 });
});
