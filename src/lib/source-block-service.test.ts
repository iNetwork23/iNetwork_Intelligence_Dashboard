import {describe,expect,it,vi} from 'vitest';
import {MemorySecurityStore} from './security';
import {activateSourceBlock,deactivateSourceBlock,listSourceBlocks} from './source-block-service';
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
});
