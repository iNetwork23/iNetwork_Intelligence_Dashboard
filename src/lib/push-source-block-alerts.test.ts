import{createECDH}from'node:crypto';
import{describe,expect,it}from'vitest';
import{MemorySecurityStore}from'./security';
import{dispatchPushOutbox,enqueuePushAlert,enqueueSourceBlockManagerAlert,mayReceiveSourceBlockAlerts,savePushSubscription,SOURCE_BLOCK_MANAGER_AUDIENCE}from'./push-notifications';
import{parseAccessMetadata}from'./rbac';
const keys=()=>({p256dh:createECDH('prime256v1').generateKeys().toString('base64url'),auth:Buffer.alloc(16,1).toString('base64url')});
const subscribe=(store:MemorySecurityStore,userId:string)=>savePushSubscription(userId,{endpoint:`https://fcm.googleapis.com/${userId}`,expirationTime:null,keys:keys()},'test',store);
const access={manager:parseAccessMetadata({role:'admin'}),employee:parseAccessMetadata({role:'employee',grants:['landingpages.manage','api.manage']}),automationOnly:parseAccessMetadata({role:'employee',grants:['automations.manage','campaigns.edit']}),partner:parseAccessMetadata({role:'partner',grants:['landingpages.manage','api.manage'],scopes:{affiliate:['30']}}),readOnly:parseAccessMetadata({role:'read_only'})};
const outboxRows=(store:MemorySecurityStore)=>[...store.values.entries()].filter(([key])=>key.startsWith('push:outbox:v1:')).map(([,value])=>value as Record<string,unknown>);

describe('push audience for source block managers',()=>{
 it('requires an internal role with landingpages.manage and api.manage',()=>{
  expect(mayReceiveSourceBlockAlerts(access.manager)).toBe(true);
  expect(mayReceiveSourceBlockAlerts(access.employee)).toBe(true);
  expect(mayReceiveSourceBlockAlerts(access.automationOnly)).toBe(false);
  expect(mayReceiveSourceBlockAlerts(access.partner)).toBe(false);
  expect(mayReceiveSourceBlockAlerts(access.readOnly)).toBe(false);
 });
 it('stores the manager audience as its own exact shape and dedupes like automation alerts',async()=>{
  const store=new MemorySecurityStore();
  expect(await enqueueSourceBlockManagerAlert('payout_despite_block:a:2026-09-04',{title:'Payout trotz Sperre',body:'Text',path:'/source-blocks'},store)).toBe(true);
  expect(await enqueueSourceBlockManagerAlert('payout_despite_block:a:2026-09-04',{title:'Payout trotz Sperre',body:'Text',path:'/source-blocks'},store)).toBe(false);
  expect(outboxRows(store)).toEqual([expect.objectContaining({version:1,audience:{kind:'sperrberechtigte'},payload:{title:'Payout trotz Sperre',body:'Text',path:'/source-blocks',tag:'wlx-alert'}})]);
  await expect(enqueuePushAlert('x',{title:'T',body:'B',path:'/'},{kind:'sperrberechtigte',affiliateId:1} as unknown as typeof SOURCE_BLOCK_MANAGER_AUDIENCE,store)).rejects.toThrow(/Audience/);
  await expect(enqueuePushAlert('y',{title:'T',body:'B',path:'/'},{kind:'andere'} as unknown as typeof SOURCE_BLOCK_MANAGER_AUDIENCE,store)).rejects.toThrow(/Audience/);
 });
 it('delivers manager alerts only to subscribers whose stored access may block sources',async()=>{
  const store=new MemorySecurityStore();
  for(const userId of Object.keys(access))await subscribe(store,userId);
  await enqueueSourceBlockManagerAlert('payout_despite_block:a:2026-09-04',{title:'Payout trotz Sperre',body:'Text',path:'/source-blocks'},store);
  const delivered:string[]=[];
  const result=await dispatchPushOutbox(store,{ensureTransport:()=>undefined,loadAccess:async userId=>access[userId as keyof typeof access]??null,deliver:async userId=>{delivered.push(userId);return{ok:true as const}}});
  expect(result).toEqual([expect.objectContaining({sent:2,ok:true})]);
  expect(delivered.sort()).toEqual(['employee','manager']);
  expect(outboxRows(store)[0]).toMatchObject({version:2});
 });
 it('keeps automation alerts on the automation audience rules',async()=>{
  const store=new MemorySecurityStore();
  for(const userId of Object.keys(access))await subscribe(store,userId);
  await enqueuePushAlert('automation:a',{title:'Automation',body:'Text',path:'/automation'},{affiliateId:30,campaignId:2,offerIds:[3]},store);
  const delivered:string[]=[];
  await dispatchPushOutbox(store,{ensureTransport:()=>undefined,loadAccess:async userId=>access[userId as keyof typeof access]??null,deliver:async userId=>{delivered.push(userId);return{ok:true as const}}});
  expect(delivered.sort()).toEqual(['automationOnly','manager']);
 });
 it('quarantines a manager audience row that carries extra fields',async()=>{
  const store=new MemorySecurityStore();
  await enqueueSourceBlockManagerAlert('q',{title:'T',body:'B',path:'/source-blocks'},store);
  const key=[...store.values.keys()].find(value=>value.startsWith('push:outbox:v1:'))!,row=await store.get(key) as Record<string,unknown>;
  await store.set(key,{...row,audience:{kind:'sperrberechtigte',offerIds:[1]}});
  await dispatchPushOutbox(store,{ensureTransport:()=>undefined,loadAccess:async()=>access.manager,deliver:async()=>({ok:true as const})});
  expect(await store.get(key)).toMatchObject({version:4,reason:'malformed'});
 });
});
