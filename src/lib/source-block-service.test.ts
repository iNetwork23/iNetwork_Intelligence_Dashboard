import {describe,expect,it,vi} from 'vitest';
import {MemorySecurityStore} from './security';
import {activateSourceBlock,activateSourceBlocksAtomically,deactivateSourceBlock,listSourceBlocks} from './source-block-service';
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
  expect(deactivate).toHaveBeenCalledWith(777);
  expect(result).toMatchObject({status:'inactive',updatedBy:'admin-2',everflowSettingId:null});
 });
 it('rolls back Everflow when durable activation state cannot be committed',async()=>{
  class FailingStore extends MemorySecurityStore{writes=0;override async set(k:string,v:unknown){this.writes++;if(this.writes===2)throw new Error('store down');return super.set(k,v)}}
  const store=new FailingStore(),rollback=vi.fn(async()=>({deleted:true}));
  await expect(activateSourceBlock(store,input,{actorId:'admin',activate:async()=>({settingId:777,created:true}),deactivate:rollback})).rejects.toThrow('store down');
  expect(rollback).toHaveBeenCalledWith(777);
 });
 it('rolls back only rules newly created by a failed product-wide activation',async()=>{
  const store=new MemorySecurityStore(),removed:number[]=[];
  await activateSourceBlock(store,input,{actorId:'admin',activate:async()=>({settingId:700,created:true}),deactivate:async id=>{removed.push(id);return{deleted:true}}});
  const offers=[{...input,offerId:'25'},{...input,offerId:'26',offerName:'Offer 26'},{...input,offerId:'27',offerName:'Offer 27'}];
  await expect(activateSourceBlocksAtomically(store,offers,{actorId:'admin',activate:async block=>{if(block.offerId===27)throw new Error('third failed');return{settingId:700+block.offerId,created:true}},deactivate:async id=>{removed.push(id);return{deleted:true}}})).rejects.toThrow('third failed');
  expect(removed).toEqual([726]);
  expect((await listSourceBlocks(store)).find(x=>x.offerId===25)?.status).toBe('active');
 });
});
