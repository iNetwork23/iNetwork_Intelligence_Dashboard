import {beforeEach,describe,expect,it,vi} from 'vitest';
import {MemorySecurityStore} from './security';
import {DEAL_REGISTER_STORE_KEY,DEFAULT_DEAL_RULES} from './deal-register';
vi.mock('server-only',()=>({}));
const cache=vi.hoisted(()=>({expired:[]as unknown[],keys:[]as string[][]}));
vi.mock('next/cache',()=>({unstable_cache:(load:()=>unknown,keyParts:string[])=>{cache.keys.push(keyParts);return load},revalidateTag:(tag:string,options:unknown)=>{cache.expired.push([tag,options])}}));
const store=new MemorySecurityStore();
vi.mock('./access-store',()=>({securityStore:()=>store}));
import {DealRegisterValidationError,loadDealRegister,loadDealRegisterState,readDealRegisterState,readEditableDealRegister,DealRegisterConflictError,saveDealRegister as saveRevision} from './deal-register-store';

const saveDealRegister=async(rules:unknown,actor:string,target=store,now=new Date())=>saveRevision(rules,actor,(await readEditableDealRegister(target)).revision,target,now);

describe('deal register store (sync_state deal_register:v1, additive)',()=>{
 beforeEach(()=>{store.values.clear();cache.expired.length=0;cache.keys.length=0});
 it('falls back to the former constants when nothing is stored and marks the source',async()=>{
  await expect(readDealRegisterState(store)).resolves.toEqual({rules:DEFAULT_DEAL_RULES,source:'defaults'});
  await expect(loadDealRegisterState()).resolves.toMatchObject({source:'defaults'});
  expect(cache.keys[0]).toEqual(['deal-register-v1']);
 });
 it('treats a stored register as authoritative even when it is empty',async()=>{
  await store.set(DEAL_REGISTER_STORE_KEY,{version:1,rules:[],updatedAt:'x',updatedBy:'u'});
  await expect(readDealRegisterState(store)).resolves.toEqual({rules:[],source:'stored'});
  await expect(loadDealRegister()).resolves.toEqual([]);
 });
 it('validates, stamps changed rules with actor and time, keeps stamps of unchanged rules and expires the cache tag',async()=>{
  const first=await saveDealRegister([{affiliateId:436,testQuotaSois:50,maturityHours:336,note:'TC'}],'admin-1',store,new Date('2026-09-04T10:00:00Z'));
  expect(first.before.source).toBe('defaults');
  expect(first.after).toEqual([{affiliateId:436,testQuotaSois:50,maturityHours:336,note:'TC',updatedAt:'2026-09-04T10:00:00.000Z',updatedBy:'admin-1'}]);
  expect(cache.expired).toEqual([['deal-register',{expire:0}]]);
  const second=await saveDealRegister([{affiliateId:436,testQuotaSois:50,maturityHours:336,note:'TC'},{affiliateId:6,campaignId:2,cvrFloorPct:1,note:''}],'admin-2',store,new Date('2026-09-05T10:00:00Z'));
  expect(second.before).toEqual({rules:first.after,source:'stored'});
  expect(second.after[0]).toMatchObject({updatedAt:'2026-09-04T10:00:00.000Z',updatedBy:'admin-1'});
  expect(second.after[1]).toMatchObject({affiliateId:6,campaignId:2,cvrFloorPct:1,updatedAt:'2026-09-05T10:00:00.000Z',updatedBy:'admin-2'});
  expect(await store.get(DEAL_REGISTER_STORE_KEY)).toMatchObject({version:1,updatedBy:'admin-2',rules:second.after});
  expect([...store.values.keys()]).toEqual([DEAL_REGISTER_STORE_KEY]);
 });
 it('rejects invalid input without touching the store',async()=>{
  await expect(saveDealRegister([{affiliateId:0}],'admin',store)).rejects.toBeInstanceOf(DealRegisterValidationError);
  expect(store.values.size).toBe(0);
 });
 it('never fails the engine path: store errors fall back to the defaults',async()=>{
  const broken=new MemorySecurityStore();broken.get=async()=>{throw new Error('down')};
  const spy=vi.spyOn(console,'error').mockImplementation(()=>{});
  vi.spyOn(store,'get').mockRejectedValueOnce(new Error('down'));
  await expect(loadDealRegister()).resolves.toEqual(DEFAULT_DEAL_RULES);
  await expect(readDealRegisterState(broken)).rejects.toThrow('down');
  spy.mockRestore();
 });
});

describe('deal register atomic revisions',()=>{
 it.each(['absent','legacy','versioned'] as const)('allows only one simultaneous editor of a %s register',async(kind)=>{
  let waiting=0,release!:()=>void,racing=false;const both=new Promise<void>(resolve=>{release=resolve});
  class RacingStore extends MemorySecurityStore{override async get(key:string){const value=await super.get(key);if(racing&&key===DEAL_REGISTER_STORE_KEY){if(++waiting===2)release();await both}return value}}
  const target=new RacingStore();
  if(kind!=='absent')await target.set(DEAL_REGISTER_STORE_KEY,{version:1,...(kind==='versioned'?{revision:'revision-a'}:{}),rules:[{affiliateId:10,testQuotaSois:25,note:'',updatedAt:'old',updatedBy:'first'}]});
  const opened=await readEditableDealRegister(target);racing=true;
  const results=await Promise.allSettled([saveRevision([{affiliateId:10,testQuotaSois:30}],'a',opened.revision,target),saveRevision([{affiliateId:20,testQuotaSois:40}],'b',opened.revision,target)]);
  expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
  const rejected=results.find(result=>result.status==='rejected') as PromiseRejectedResult;expect(rejected.reason).toBeInstanceOf(DealRegisterConflictError);
  const winner=results.find(result=>result.status==='fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof saveRevision>>>;
  expect(await readEditableDealRegister(target)).toMatchObject({rules:winner.value.after,revision:winner.value.revision,source:'stored'});
 });
 it.each([{version:1},{version:1,rules:[{affiliateId:10,testQuotaSois:-5,note:'',updatedAt:'old',updatedBy:'a'}]},{version:1,rules:[{invalid:true}]}])('refuses to edit or replace a damaged register',async(raw)=>{
  const target=new MemorySecurityStore();await target.set(DEAL_REGISTER_STORE_KEY,raw);
  await expect(readEditableDealRegister(target)).rejects.toThrow(/ungültig/);
  await expect(saveRevision([{affiliateId:10,testQuotaSois:25}],'a','old',target)).rejects.toThrow(/ungültig/);
  expect(await target.get(DEAL_REGISTER_STORE_KEY)).toEqual(raw);
 });
 it('requires the refreshed revision for subsequent saves, including empty registers',async()=>{
  const target=new MemorySecurityStore(),opened=await readEditableDealRegister(target);
  const first=await saveRevision([],'a',opened.revision,target);
  await expect(saveRevision([{affiliateId:10,testQuotaSois:25}],'b',opened.revision,target)).rejects.toBeInstanceOf(DealRegisterConflictError);
  const second=await saveRevision([{affiliateId:10,testQuotaSois:25}],'a',first.revision,target);
  expect(second.revision).not.toBe(first.revision);expect(second.before).toEqual({source:'stored',rules:[]});
 });
});
