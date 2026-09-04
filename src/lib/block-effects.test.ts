import {beforeEach,describe,expect,it,vi} from 'vitest';
import {MemorySecurityStore} from './security';
import {activateSourceBlock} from './source-block-service';
import {sourceBlockIdentityKey,sourceBlockStoreKey} from './source-blocks';
vi.mock('server-only',()=>({}));
vi.mock('next/cache',()=>({unstable_cache:(load:()=>unknown)=>load}));
const store=new MemorySecurityStore();
vi.mock('./access-store',()=>({securityStore:()=>store}));
const loadRows=vi.fn();
vi.mock('./cached-evaluations',()=>({loadAffiliateSourceRowsRangeFromCache:(range:{from:string;to:string},affiliateId:string)=>loadRows(range,affiliateId)}));
const row=(date:string,affiliate:string,offer:string,main:string,sub:string,cv:number,payout:number)=>({columns:[{column_type:'date',id:date,label:date},{column_type:'affiliate',id:affiliate,label:affiliate},{column_type:'offer',id:offer,label:`Offer ${offer}`},{column_type:'traffic_mode',id:'tracked',label:'tracked'},{column_type:'source_id',id:main,label:main},{column_type:'sub1',id:sub||'N/A',label:sub||'N/A'}],reporting:{total_click:10,cv,payout,revenue:0,profit:-payout}});
const input={affiliateId:'30',affiliateName:'Partner',offerId:'25',offerName:'Offer 25',trafficMode:'tracked' as const,level:'main_source' as const,mainValue:'src-1'};
const writer={actorId:'admin',activate:vi.fn(async()=>({settingId:700+writer.activate.mock.calls.length,created:true})),deactivate:vi.fn(async()=>({deleted:true}))};

describe('block effects',()=>{
 beforeEach(()=>{store.values.clear();loadRows.mockReset();writer.activate.mockClear()});
 it('indexes every record by its identity key regardless of status',async()=>{
  const {loadBlockIndex}=await import('./block-effects');
  const active=await activateSourceBlock(store,input,writer),other=await activateSourceBlock(store,{...input,offerId:'26',offerName:'Offer 26'},writer);
  await store.set(sourceBlockStoreKey(other),{...other,status:'inactive',everflowSettingId:null});
  const index=await loadBlockIndex(store);
  expect([...index.keys()].sort()).toEqual([sourceBlockIdentityKey(active),sourceBlockIdentityKey(other)].sort());
  expect(index.get(sourceBlockIdentityKey(active))?.status).toBe('active');
  expect(index.get(sourceBlockIdentityKey(other))?.status).toBe('inactive');
  expect(index.get('30:99:tracked:main_source:source_id:src-1:sub1:%E2%88%85')).toBeUndefined();
 });
 it('sums post-cutoff violations per active block from the affiliate snapshot rows and skips inactive blocks',async()=>{
  const {loadBlockEffects}=await import('./block-effects');
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-08-20T09:00:00Z'));
  const active=await activateSourceBlock(store,input,writer),inactiveSource=await activateSourceBlock(store,{...input,mainValue:'src-2'},writer);
  vi.useRealTimers();
  await store.set(sourceBlockStoreKey(inactiveSource),{...inactiveSource,status:'inactive',everflowSettingId:null});
  loadRows.mockResolvedValue([row('2026-08-19','30','25','src-1','a',5,10),row('2026-08-21','30','25','src-1','a',3,1.5),row('2026-08-22','30','25','src-1','b',2,0),row('2026-08-22','30','26','src-1','a',9,9),row('2026-08-22','30','25','src-2','a',7,7)]);
  const effects=await loadBlockEffects({from:'2026-08-01',to:'2026-08-31'});
  expect(loadRows).toHaveBeenCalledWith({from:'2026-08-01',to:'2026-08-31'},'30');
  expect(effects).toHaveLength(1);
  expect(effects[0]).toMatchObject({identityKey:sourceBlockIdentityKey(active),soisSince:5,payoutSince:1.5,lastTrafficDate:'2026-08-22'});
  expect(effects[0].record.id).toBe(active.id);
 });
 it('loads rows from the earliest effective date when the range starts later and filters by affiliate',async()=>{
  const {loadBlockEffects}=await import('./block-effects');
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-07-10T09:00:00Z'));
  await activateSourceBlock(store,input,writer);await activateSourceBlock(store,{...input,affiliateId:'31'},writer);
  vi.useRealTimers();
  loadRows.mockResolvedValue([]);
  const effects=await loadBlockEffects({from:'2026-08-01',to:'2026-08-31'},'31');
  expect(loadRows).toHaveBeenCalledTimes(1);
  expect(loadRows).toHaveBeenCalledWith({from:'2026-07-10',to:'2026-08-31'},'31');
  expect(effects.map(effect=>String(effect.record.affiliateId))).toEqual(['31']);
  expect(effects[0]).toMatchObject({soisSince:0,payoutSince:0,lastTrafficDate:null});
 });
});
