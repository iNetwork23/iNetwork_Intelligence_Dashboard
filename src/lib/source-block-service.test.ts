import {describe,expect,it,vi} from 'vitest';
import {MemorySecurityStore} from './security';
import {activateSourceBlock,activateSourceBlocksAtomically,deactivateSourceBlock,listSourceBlocks} from './source-block-service';
import {SourceBlockActivationCompensatedError,sourceBlockStoreKey} from './source-blocks';
const input={affiliateId:'30',affiliateName:'DatingLeads by Lewis',offerId:'25',offerName:'WhatsMeet - API',trafficMode:'api' as const,level:'sub_source' as const,mainValue:null,subValue:'P-3591625022'};

describe('source block persistence',()=>{
 it('persists a verified active block and is idempotent',async()=>{
  const store=new MemorySecurityStore(),writer=vi.fn(async()=>({settingId:777,created:true}));
  const first=await activateSourceBlock(store,input,{actorId:'admin',activate:writer,deactivate:vi.fn()});
  const second=await activateSourceBlock(store,input,{actorId:'admin',activate:writer,deactivate:vi.fn()});
  expect(first.status).toBe('active');expect(first.everflowSettingId).toBe(777);expect(second.id).toBe(first.id);expect(writer).toHaveBeenCalledTimes(1);
  expect(await listSourceBlocks(store)).toHaveLength(1);
 });
 it('removes the exact Everflow setting and retains an inactive audit record',async()=>{
  const store=new MemorySecurityStore(),deactivate=vi.fn(async()=>({deleted:true}));
  const active=await activateSourceBlock(store,input,{actorId:'admin',activate:async()=>({settingId:777,created:true}),deactivate});
  const result=await deactivateSourceBlock(store,active.id,{actorId:'admin-2',activate:vi.fn(),deactivate});
  expect(deactivate).toHaveBeenCalledWith(777,expect.objectContaining({affiliateId:30,offerId:25,level:'sub_source',subValue:'P-3591625022'}));
  expect(result).toMatchObject({status:'inactive',updatedBy:'admin-2',everflowSettingId:null});
 });
 it('rolls back Everflow when durable activation state cannot be committed',async()=>{
  class FailingStore extends MemorySecurityStore{writes=0;override async set(k:string,v:unknown){this.writes++;if(this.writes===2)throw new Error('store down');return super.set(k,v)}}
  const store=new FailingStore(),rollback=vi.fn(async()=>({deleted:true}));
  await expect(activateSourceBlock(store,input,{actorId:'admin',activate:async()=>({settingId:777,created:true}),deactivate:rollback})).rejects.toThrow('store down');
  expect(rollback).toHaveBeenCalledWith(777,expect.objectContaining({affiliateId:30,offerId:25,level:'sub_source',subValue:'P-3591625022'}));
 });
 it('records an uncertain incident when Everflow activation itself cannot be verified',async()=>{
  const store=new MemorySecurityStore();
  await expect(activateSourceBlock(store,input,{actorId:'admin',activate:async()=>{throw new Error('activation verification failed')},deactivate:vi.fn()})).rejects.toMatchObject({name:'SourceBlockStateUncertainError'});
  expect((await listSourceBlocks(store))[0]).toMatchObject({status:'error',everflowSettingId:null});
 });
 it('restores the prior durable state after an externally verified activation rollback',async()=>{
  const store=new MemorySecurityStore();
  await expect(activateSourceBlock(store,input,{actorId:'admin',activate:async()=>{throw new SourceBlockActivationCompensatedError('Everflow-Regel entfernt')},deactivate:vi.fn()})).rejects.toThrow('Everflow-Regel entfernt');
  expect(await listSourceBlocks(store)).toEqual([]);
 });
 it('restores the original state when activation audit fails',async()=>{
  const store=new MemorySecurityStore(),rollback=vi.fn(async()=>({deleted:true}));
  await expect(activateSourceBlock(store,input,{actorId:'admin',activate:async()=>({settingId:777,created:true}),deactivate:rollback},async()=>{throw new Error('audit down')})).rejects.toThrow('wiederhergestellt');
  expect(rollback).toHaveBeenCalledWith(777,expect.objectContaining({affiliateId:30,offerId:25,level:'sub_source',subValue:'P-3591625022'}));
  expect(await listSourceBlocks(store)).toEqual([]);
 });
 it('passes the exact in-lock previous record to activation audit',async()=>{
  const store=new MemorySecurityStore(),writer={actorId:'admin',activate:vi.fn(async()=>({settingId:778,created:true})),deactivate:vi.fn(async()=>({deleted:true}))},active=await activateSourceBlock(store,input,{...writer,activate:vi.fn(async()=>({settingId:777,created:true}))}),prior={...active,status:'inactive' as const,everflowSettingId:null,error:'old'};
  await store.set(sourceBlockStoreKey(active),prior);
  const commit=vi.fn(async(...args:unknown[])=>{void args});
  await activateSourceBlock(store,input,writer,commit);
  expect(commit.mock.calls[0]?.[1]).toEqual(prior);
 });
 it('persists an explicit uncertain incident when activation audit and compensation fail',async()=>{
  const store=new MemorySecurityStore();
  await expect(activateSourceBlock(store,input,{actorId:'admin',activate:async()=>({settingId:777,created:true}),deactivate:async()=>{throw new Error('rollback down')}},async()=>{throw new Error('audit down')})).rejects.toMatchObject({name:'SourceBlockStateUncertainError'});
  expect((await listSourceBlocks(store))[0]).toMatchObject({status:'error',everflowSettingId:777});
 });
 it('reactivates and verifies a block when deactivation audit fails',async()=>{
  const store=new MemorySecurityStore(),activate=vi.fn(async()=>({settingId:778,created:true})),deactivate=vi.fn(async()=>({deleted:true}));
  const active=await activateSourceBlock(store,input,{actorId:'admin',activate:async()=>({settingId:777,created:true}),deactivate});
  await expect(deactivateSourceBlock(store,active.id,{actorId:'admin',activate,deactivate},async()=>{throw new Error('audit down')})).rejects.toThrow('wiederhergestellt');
  expect(activate).toHaveBeenCalled();
  expect((await listSourceBlocks(store))[0]).toMatchObject({status:'active',everflowSettingId:778});
 });
 it('records an uncertain incident when Everflow deactivation itself cannot be verified',async()=>{
  const store=new MemorySecurityStore(),active=await activateSourceBlock(store,input,{actorId:'admin',activate:async()=>({settingId:777,created:true}),deactivate:vi.fn()});
  await expect(deactivateSourceBlock(store,active.id,{actorId:'admin',activate:vi.fn(),deactivate:async()=>{throw new Error('deactivation verification failed')}})).rejects.toMatchObject({name:'SourceBlockStateUncertainError'});
  expect((await listSourceBlocks(store))[0]).toMatchObject({status:'error',everflowSettingId:777});
 });
 it.each(['error','pending'] as const)('preserves a previous %s record when deactivation audit rollback succeeds',async status=>{
  const store=new MemorySecurityStore(),writer={actorId:'admin',activate:vi.fn().mockResolvedValue({settingId:71,created:true}),deactivate:vi.fn().mockResolvedValue({deleted:true})},
   active=await activateSourceBlock(store,input,writer),prior={...active,status,error:'Vorheriger Incident',updatedAt:'2026-07-01T00:00:00.000Z'};
  await store.set(sourceBlockStoreKey(active),prior);
  await expect(deactivateSourceBlock(store,active.id,writer,async()=>{throw new Error('audit down')})).rejects.toThrow('ursprüngliche Zustand');
  expect(await store.get(sourceBlockStoreKey(active))).toEqual(prior);
 });
 it('rolls back only rules newly created by a failed product-wide activation',async()=>{
  const store=new MemorySecurityStore(),removed:number[]=[];
  await activateSourceBlock(store,input,{actorId:'admin',activate:async()=>({settingId:700,created:true}),deactivate:async id=>{removed.push(id);return{deleted:true}}});
  const offers=[{...input,offerId:'25'},{...input,offerId:'26',offerName:'Offer 26'},{...input,offerId:'27',offerName:'Offer 27'}];
  await expect(activateSourceBlocksAtomically(store,offers,{actorId:'admin',activate:async block=>{if(block.offerId===27)throw new Error('third failed');return{settingId:700+block.offerId,created:true}},deactivate:async id=>{removed.push(id);return{deleted:true}}})).rejects.toThrow('third failed');
  expect(removed).toEqual([726]);
  expect((await listSourceBlocks(store)).find(x=>x.offerId===25)?.status).toBe('active');
 });
 it('rolls back newly created product-wide rules when the group audit fails',async()=>{
  const store=new MemorySecurityStore(),removed:number[]=[];
  await activateSourceBlock(store,input,{actorId:'admin',activate:async()=>({settingId:725,created:true}),deactivate:async id=>{removed.push(id);return{deleted:true}}});
  const offers=[{...input,offerId:'25'},{...input,offerId:'26',offerName:'Offer 26'}];
  await expect(activateSourceBlocksAtomically(store,offers,{actorId:'admin',activate:async block=>({settingId:700+block.offerId,created:true}),deactivate:async id=>{removed.push(id);return{deleted:true}}},async()=>{throw new Error('audit down')})).rejects.toThrow('wiederhergestellt');
  expect(removed).toEqual([726]);
  expect((await listSourceBlocks(store)).map(x=>[x.offerId,x.status])).toEqual([[25,'active']]);
 });
 it.each(['inactive','error','pending'] as const)('restores the exact prior %s record after a failed group audit',async status=>{
  const store=new MemorySecurityStore(),deactivate=vi.fn(async()=>({deleted:true}));
  const active=await activateSourceBlock(store,input,{actorId:'admin',activate:async()=>({settingId:777,created:true}),deactivate});
  const prior={...active,status,everflowSettingId:null,error:status==='error'?'existing incident':null};
  await store.set(sourceBlockStoreKey(active),prior);
  await expect(activateSourceBlocksAtomically(store,[input],{actorId:'admin',activate:async()=>({settingId:778,created:true}),deactivate},async()=>{throw new Error('audit down')})).rejects.toThrow('wiederhergestellt');
  expect((await listSourceBlocks(store))[0]).toEqual(prior);
 });
 it('serializes product-wide and individual source mutations with one global lock',async()=>{
  const store=new MemorySecurityStore();let release!:()=>void,started!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve}),entered=new Promise<void>(resolve=>{started=resolve});
  const group=activateSourceBlocksAtomically(store,[input],{actorId:'admin',activate:async()=>{started();await gate;return{settingId:777,created:true}},deactivate:async()=>({deleted:true})});
  await entered;
  await expect(activateSourceBlock(store,{...input,offerId:'26'},{actorId:'admin',activate:async()=>({settingId:778,created:true}),deactivate:async()=>({deleted:true})})).rejects.toThrow('sicherheitskritische Änderung läuft');
  release();await group;
 });
 it('reauthorizes inside the mutation lock before any external write',async()=>{
  const store=new MemorySecurityStore(),events:string[]=[],writer={actorId:'admin',authorize:async()=>{events.push('authorize')},activate:vi.fn(async()=>{events.push('write');return{settingId:777,created:true}}),deactivate:vi.fn(async()=>({deleted:true}))};
  await activateSourceBlock(store,input,writer);
  expect(events).toEqual(['authorize','write']);
 });
 it('does not write externally when fresh authorization was revoked',async()=>{
  const store=new MemorySecurityStore(),writer={actorId:'admin',authorize:async()=>{throw new Error('Keine Berechtigung')},activate:vi.fn(async()=>({settingId:777,created:true})),deactivate:vi.fn(async()=>({deleted:true}))};
  await expect(activateSourceBlock(store,input,writer)).rejects.toThrow('Keine Berechtigung');
  expect(writer.activate).not.toHaveBeenCalled();
 });
 it('authorizes and audits the exact fresh record used for deactivation',async()=>{
  const store=new MemorySecurityStore(),baseWriter={actorId:'admin',activate:vi.fn(async()=>({settingId:777,created:true})),deactivate:vi.fn(async()=>({deleted:true}))},active=await activateSourceBlock(store,input,baseWriter),changed={...active,offerId:99,offerName:'Offer 99'};
  await store.delete(sourceBlockStoreKey(active));await store.set(sourceBlockStoreKey(changed),changed);
  const authorize=vi.fn(async(record)=>{expect(record).toEqual(changed);throw new Error('Keine Berechtigung')});
  await expect(deactivateSourceBlock(store,changed.id,{...baseWriter,authorize})).rejects.toThrow('Keine Berechtigung');
  expect(baseWriter.deactivate).not.toHaveBeenCalled();
 });
 it('passes the exact position-aligned in-lock previous records to group audit',async()=>{
  const store=new MemorySecurityStore(),writer={actorId:'admin',activate:vi.fn(async()=>({settingId:900+writer.activate.mock.calls.length,created:true})),deactivate:vi.fn(async()=>({deleted:true}))},first=await activateSourceBlock(store,input,writer),prior={...first,status:'inactive' as const,everflowSettingId:null,error:'prior'};
  await store.set(sourceBlockStoreKey(first),prior);
  const second={...input,offerId:'26',offerName:'Offer 26'},commit=vi.fn(async(...args:unknown[])=>{void args});
  await activateSourceBlocksAtomically(store,[input,second],writer,commit);
  expect(commit.mock.calls[0]?.[1]).toEqual([prior,null]);
 });
});

describe('source block reason category',()=>{
 it('persists a valid reason category, keeps the previous one on reactivation and ignores unknown values',async()=>{
  const store=new MemorySecurityStore(),writer={actorId:'admin',activate:vi.fn(async()=>({settingId:777,created:true})),deactivate:vi.fn(async()=>({deleted:true}))};
  const active=await activateSourceBlock(store,{...input,reasonCategory:'fraud',reason:'Bot-Traffic'},writer);
  expect(active).toMatchObject({reasonCategory:'fraud',reason:'Bot-Traffic'});
  await deactivateSourceBlock(store,active.id,writer);
  const reactivated=await activateSourceBlock(store,{...input,reasonCategory:'nope' as 'fraud'},writer);
  expect(reactivated.reasonCategory).toBe('fraud');
  const store2=new MemorySecurityStore();
  expect((await activateSourceBlock(store2,input,writer)).reasonCategory).toBeUndefined();
 });
});

describe('source block reference metrics persistence (Etappe 4)',()=>{
 const metricsAtBlock={windowDays:30,clicks:120,sois:12,payout:36,revenue:9,capturedAt:'2026-09-04T10:00:00.000Z'};
 it('persists a valid metricsAtBlock from the input and drops an invalid structure',async()=>{
  const store=new MemorySecurityStore(),writer={actorId:'admin',activate:vi.fn(async()=>({settingId:777,created:true})),deactivate:vi.fn(async()=>({deleted:true}))};
  const active=await activateSourceBlock(store,{...input,metricsAtBlock},writer);
  expect(active.metricsAtBlock).toEqual(metricsAtBlock);
  const other=await activateSourceBlock(store,{...input,offerId:'26',metricsAtBlock:{...metricsAtBlock,sois:'12'} as never},writer);
  expect(other.metricsAtBlock).toBeUndefined();
 });
 it('does not inherit the reference from a previous inactive record when reactivating',async()=>{
  const store=new MemorySecurityStore(),writer={actorId:'admin',activate:vi.fn(async()=>({settingId:777,created:true})),deactivate:vi.fn(async()=>({deleted:true}))};
  const active=await activateSourceBlock(store,{...input,metricsAtBlock},writer);
  await store.set(sourceBlockStoreKey(active),{...active,status:'inactive',everflowSettingId:null});
  const reactivated=await activateSourceBlock(store,input,writer);
  expect(reactivated.status).toBe('active');expect(reactivated.metricsAtBlock).toBeUndefined();
 });
});
