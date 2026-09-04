import {describe,expect,it,vi} from 'vitest';
import {MemorySecurityStore} from './security';
import {listSourceBlockHistory,recordSourceBlockHistory,SOURCE_BLOCK_HISTORY_LIMIT,SOURCE_BLOCK_REASON_LABELS,sourceBlockHistoryKey} from './source-block-history';
vi.mock('./access-store',()=>({securityStore:()=>{throw new Error('default store must not be used in tests')}}));
const base={blockId:'block-a',identityKey:'30:25:api:sub_source:adv1:%E2%88%85:adv2:P-1',actorId:'admin'} as const;

describe('source block history',()=>{
 it('appends one immutable key per event under source_block_history:{blockId}:{at}:{id}',async()=>{
  const store=new MemorySecurityStore();
  await recordSourceBlockHistory({...base,action:'activate',reasonCategory:'fraud',reason:'  Bot-Traffic  ',after:{status:'active'}},store);
  const keys=[...store.values.keys()];
  expect(keys).toHaveLength(1);
  const event=(await listSourceBlockHistory('block-a',store))[0];
  expect(keys[0]).toBe(`source_block_history:block-a:${event.at}:${event.id}`);
  expect(keys[0]).toBe(sourceBlockHistoryKey(event));
  expect(event).toMatchObject({blockId:'block-a',identityKey:base.identityKey,actorId:'admin',action:'activate',reasonCategory:'fraud',reason:'Bot-Traffic',after:{status:'active'}});
  expect(typeof event.id).toBe('string');expect(event.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
 });
 it('lists newest first and filters by block id',async()=>{
  const store=new MemorySecurityStore();
  const at=vi.spyOn(Date.prototype,'toISOString');
  at.mockReturnValueOnce('2026-09-01T10:00:00.000Z');await recordSourceBlockHistory({...base,action:'activate'},store);
  at.mockReturnValueOnce('2026-09-02T10:00:00.000Z');await recordSourceBlockHistory({...base,action:'deactivate',reasonCategory:'test'},store);
  at.mockReturnValueOnce('2026-09-03T10:00:00.000Z');await recordSourceBlockHistory({...base,blockId:'block-b',action:'activate_failed',error:'Everflow down'},store);
  at.mockRestore();
  expect((await listSourceBlockHistory('block-a',store)).map(event=>[event.action,event.at])).toEqual([['deactivate','2026-09-02T10:00:00.000Z'],['activate','2026-09-01T10:00:00.000Z']]);
  expect((await listSourceBlockHistory(undefined,store)).map(event=>event.action)).toEqual(['activate_failed','deactivate','activate']);
  expect(await listSourceBlockHistory('unknown',store)).toEqual([]);
 });
 it('caps the listing at the history limit while keeping every event stored',async()=>{
  const store=new MemorySecurityStore();
  for(let index=0;index<SOURCE_BLOCK_HISTORY_LIMIT+5;index++)await recordSourceBlockHistory({...base,action:'reconcile_ok'},store);
  expect(store.values.size).toBe(SOURCE_BLOCK_HISTORY_LIMIT+5);
  expect(await listSourceBlockHistory('block-a',store)).toHaveLength(SOURCE_BLOCK_HISTORY_LIMIT);
 });
 it('never throws when the store fails or the event is malformed',async()=>{
  class BrokenStore extends MemorySecurityStore{override async setIfAbsent():Promise<boolean>{throw new Error('store down')}}
  const error=vi.spyOn(console,'error').mockImplementation(()=>{});
  await expect(recordSourceBlockHistory({...base,action:'activate'},new BrokenStore())).resolves.toBeUndefined();
  await expect(recordSourceBlockHistory({...base,action:'explode' as 'activate'},new MemorySecurityStore())).resolves.toBeUndefined();
  expect(error).toHaveBeenCalledTimes(2);
  error.mockRestore();
 });
 it('drops unknown reason categories, trims oversized text and ignores foreign or malformed rows',async()=>{
  const store=new MemorySecurityStore();
  await store.set('source_block_history:block-a:2026-01-01T00:00:00.000Z:junk',{garbage:true});
  await store.set('source-block:v1:foo',{id:'x'});
  await recordSourceBlockHistory({...base,action:'deactivate',reasonCategory:'nope' as 'fraud',reason:'x'.repeat(600),error:'e'.repeat(1200)},store);
  const events=await listSourceBlockHistory('block-a',store);
  expect(events).toHaveLength(1);
  expect(events[0].reasonCategory).toBeUndefined();expect(events[0].reason).toHaveLength(500);expect(events[0].error).toHaveLength(1000);
 });
 it('exposes the German reason labels for every category',()=>{
  expect(SOURCE_BLOCK_REASON_LABELS).toEqual({fraud:'Fraud-Verdacht',qualitaet:'Schlechte Qualität',partnerwunsch:'Partnerwunsch',test:'Test beendet',sonstiges:'Sonstiges'});
 });
});
