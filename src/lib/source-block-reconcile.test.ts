import{readFileSync}from'node:fs';import{join}from'node:path';
import{describe,expect,it,vi}from'vitest';
import{MemorySecurityStore}from'./security';
import{normalizeSourceBlockInput,sourceBlockIdentityKey,sourceBlockStoreKey,type SourceBlockRecord}from'./source-blocks';
import{listSourceBlockHistory}from'./source-block-history';
import type{BlockEffect}from'./block-effects';
import{buildPayoutDespiteBlockAlerts,compareEverflowSettingWithBlock,loadReconcileMarkers,runPayoutDespiteBlockAlerts,runSourceBlockReconcile,selectBlocksForReconcile,sourceBlockReconcileKey,type EverflowSettingView,type SourceBlockReconcileMarker}from'./source-block-reconcile';
import{readEverflowSourceBlockSetting}from'./everflow-source-blocks';
vi.mock('./access-store',()=>({securityStore:()=>{throw new Error('default store must not be used in tests')}}));
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const base=normalizeSourceBlockInput({affiliateId:'30',affiliateName:'DatingLeads',offerId:'25',offerName:'WhatsMeet',trafficMode:'api',level:'sub_source',mainValue:null,subValue:'P-1',reason:'Bot-Traffic'});
const record=(overrides:Partial<SourceBlockRecord>={}):SourceBlockRecord=>({...base,id:'block-a',status:'active',effectiveAt:'2026-08-20T09:00:00.000Z',createdAt:'2026-08-20T09:00:00.000Z',createdBy:'admin',updatedAt:'2026-08-20T09:00:00.000Z',updatedBy:'admin',everflowSettingId:777,lastVerifiedAt:null,error:null,reasonCategory:'fraud',...overrides});
const goodSetting=(overrides:Partial<EverflowSettingView>={}):EverflowSettingView=>({network_custom_payout_revenue_setting_id:777,network_affiliate_ids:[30],network_offer_id:25,custom_setting_status:'active',is_custom_payout_enabled:true,payout_type:'cpa',payout_amount:0,payout_percentage:0,is_postback_disabled:true,relationship:{variables:{entries:[...base.variables].reverse().map(item=>({...item,network_id:1}))}},...overrides});
const seed=async(store:MemorySecurityStore,...records:SourceBlockRecord[])=>{for(const item of records)await store.set(sourceBlockStoreKey(item),item)};

describe('reconcile comparison (Setting vs. Record)',()=>{
 it('accepts the exact zero-payout postback-off setting regardless of variable order and extra fields',()=>{expect(compareEverflowSettingWithBlock(goodSetting(),record())).toEqual({status:'ok',detail:''})});
 it('reports a missing setting as mismatch',()=>{expect(compareEverflowSettingWithBlock(null,record())).toMatchObject({status:'mismatch',detail:expect.stringContaining('Setting nicht vorhanden')})});
 it('lists every deviation in one detail text',()=>{
  const result=compareEverflowSettingWithBlock(goodSetting({custom_setting_status:'inactive',payout_amount:2,is_postback_disabled:false,network_affiliate_ids:[31],network_offer_id:26,relationship:{variables:{entries:[]}}}),record());
  expect(result.status).toBe('mismatch');
  for(const part of['Status inactive statt active','Payout 2 statt 0','Postback nicht deaktiviert','Affiliate 30 nicht im Setting','Offer 26 statt 25','Variablen weichen ab'])expect(result.detail).toContain(part);
 });
 it('treats payout percentage, disabled custom payout and a foreign payout type as mismatch',()=>{
  expect(compareEverflowSettingWithBlock(goodSetting({payout_percentage:5}),record()).status).toBe('mismatch');
  expect(compareEverflowSettingWithBlock(goodSetting({is_custom_payout_enabled:false}),record()).status).toBe('mismatch');
  expect(compareEverflowSettingWithBlock(goodSetting({payout_type:'cpc'}),record()).status).toBe('mismatch');
 });
});

describe('reconcile selection',()=>{
 it('takes only active blocks with a setting id, least recently checked first, capped at the batch limit',()=>{
  const blocks=[record({id:'never',effectiveAt:'2026-08-22T00:00:00.000Z'}),record({id:'old'}),record({id:'fresh'}),record({id:'inactive',status:'inactive'}),record({id:'error',status:'error'}),record({id:'pending',status:'pending'}),record({id:'no-setting',everflowSettingId:null}),record({id:'never-earlier',effectiveAt:'2026-08-21T00:00:00.000Z'})];
  const markers=new Map<string,SourceBlockReconcileMarker>([['old',{at:'2026-09-01T00:00:00.000Z',status:'ok',detail:''}],['fresh',{at:'2026-09-04T00:00:00.000Z',status:'mismatch',detail:'x'}]]);
  expect(selectBlocksForReconcile(blocks,markers).map(item=>item.id)).toEqual(['never-earlier','never','old','fresh']);
  expect(selectBlocksForReconcile(blocks,markers,2).map(item=>item.id)).toEqual(['never-earlier','never']);
  expect(selectBlocksForReconcile(blocks,new Map(),40)).toHaveLength(4);
 });
 it('reads markers from the sync_state namespace and ignores malformed values',async()=>{
  const store=new MemorySecurityStore();
  await store.set(sourceBlockReconcileKey('block-a'),{at:'2026-09-01T00:00:00.000Z',status:'ok',detail:''});
  await store.set(sourceBlockReconcileKey('broken'),{status:'nope'});
  await store.set('source_block_history:block-a:x:y',{at:'2026-09-01T00:00:00.000Z',status:'ok',detail:''});
  const markers=await loadReconcileMarkers(store);
  expect([...markers.keys()]).toEqual(['block-a']);
  expect(sourceBlockReconcileKey('block-a')).toBe('source_block_reconcile:block-a');
 });
});

describe('reconcile runner',()=>{
 it('writes markers, records mismatch on every deviation and reconcile_ok at most once per Berlin day, never touching the record or Everflow writes',async()=>{
  const store=new MemorySecurityStore();
  await seed(store,record({id:'a'}),record({id:'b',everflowSettingId:778,offerId:26}));
  const settings=new Map<number,EverflowSettingView|null>([[777,goodSetting()],[778,goodSetting({network_offer_id:26,is_postback_disabled:false})]]);
  const readSetting=vi.fn(async(id:number)=>settings.get(id)??null);
  let clock=new Date('2026-09-04T06:00:00Z');
  const run=()=>runSourceBlockReconcile({store,readSetting,now:()=>clock});
  expect(await run()).toEqual({checked:2,ok:1,mismatch:1,unreachable:0,budgetExhausted:false});
  expect(await store.get(sourceBlockReconcileKey('a'))).toMatchObject({at:'2026-09-04T06:00:00.000Z',status:'ok',detail:'',okEventDay:'2026-09-04'});
  expect(await store.get(sourceBlockReconcileKey('b'))).toMatchObject({status:'mismatch',detail:expect.stringContaining('Postback nicht deaktiviert')});
  expect((await listSourceBlockHistory('a',store)).map(event=>event.action)).toEqual(['reconcile_ok']);
  expect((await listSourceBlockHistory('b',store)).map(event=>[event.action,event.error])).toEqual([['reconcile_mismatch',expect.stringContaining('Postback')]]);
  expect((await listSourceBlockHistory('a',store))[0]).toMatchObject({identityKey:sourceBlockIdentityKey(base),actorId:'system:reconcile'});
  clock=new Date('2026-09-04T18:00:00Z');
  await run();
  expect((await listSourceBlockHistory('a',store)).map(event=>event.action)).toEqual(['reconcile_ok']);
  expect((await listSourceBlockHistory('b',store)).map(event=>event.action)).toEqual(['reconcile_mismatch','reconcile_mismatch']);
  expect(await store.get(sourceBlockReconcileKey('a'))).toMatchObject({at:'2026-09-04T18:00:00.000Z',okEventDay:'2026-09-04'});
  clock=new Date('2026-09-04T22:30:00Z');
  await run();
  expect((await listSourceBlockHistory('a',store)).map(event=>event.action)).toEqual(['reconcile_ok','reconcile_ok']);
  expect(await store.get(sourceBlockReconcileKey('a'))).toMatchObject({okEventDay:'2026-09-05'});
  expect(await store.get(sourceBlockStoreKey(record({id:'a'})))).toEqual(record({id:'a'}));
  expect(await store.get(sourceBlockStoreKey(record({id:'b',everflowSettingId:778,offerId:26})))).toEqual(record({id:'b',everflowSettingId:778,offerId:26}));
 });
 it('marks unreachable settings without history events and keeps the previous ok day',async()=>{
  const store=new MemorySecurityStore();
  await seed(store,record({id:'a'}));
  await store.set(sourceBlockReconcileKey('a'),{at:'2026-09-03T00:00:00.000Z',status:'ok',detail:'',okEventDay:'2026-09-03'});
  const result=await runSourceBlockReconcile({store,readSetting:async()=>{throw new Error('Everflow HTTP 503')},now:()=>new Date('2026-09-04T06:00:00Z')});
  expect(result).toEqual({checked:1,ok:0,mismatch:0,unreachable:1,budgetExhausted:false});
  expect(await store.get(sourceBlockReconcileKey('a'))).toMatchObject({status:'unreachable',detail:'Everflow HTTP 503',okEventDay:'2026-09-03'});
  expect(await listSourceBlockHistory('a',store)).toEqual([]);
 });
 it('stops at the time budget and reports it',async()=>{
  const store=new MemorySecurityStore();
  await seed(store,record({id:'a'}),record({id:'b',everflowSettingId:778,offerId:26}),record({id:'c',everflowSettingId:779,offerId:27}));
  let ticks=0;const clock=()=>new Date(Date.UTC(2026,8,4,6,0,ticks++*40));
  const result=await runSourceBlockReconcile({store,readSetting:async()=>goodSetting(),now:clock,timeBudgetMs:60_000});
  expect(result.budgetExhausted).toBe(true);
  expect(result.checked).toBeLessThan(3);
  expect(result.checked).toBe(result.ok);
 });
});

describe('payout despite block alert',()=>{
 const effect=(overrides:Partial<BlockEffect>={},rec:Partial<SourceBlockRecord>={}):BlockEffect=>({record:record(rec),identityKey:sourceBlockIdentityKey(base),soisSince:3,payoutSince:0,lastTrafficDate:null,...overrides});
 it('builds one deduped alert per block and Berlin day only when payout since block is positive',()=>{
  const alerts=buildPayoutDespiteBlockAlerts([effect({payoutSince:12.5}),effect({payoutSince:0},{id:'zero'}),effect({payoutSince:-1},{id:'negative'})],new Date('2026-09-04T22:30:00Z'));
  expect(alerts).toEqual([{dedupeId:'payout_despite_block:block-a:2026-09-05',payload:{title:'Payout trotz Sperre',body:'DatingLeads · WhatsMeet · nicht übermittelt → P-1: 12,50 € seit 20.08.2026',path:'/source-blocks'}}]);
 });
 it('keeps the body inside the push limit for long names',()=>{
  const[alert]=buildPayoutDespiteBlockAlerts([effect({payoutSince:1},{affiliateName:'A'.repeat(160),offerName:'B'.repeat(160)})],new Date('2026-09-04T06:00:00Z'));
  expect(alert.payload.body.length).toBeLessThanOrEqual(240);
  expect(alert.payload.body).toContain('1,00 € seit 20.08.2026');
 });
 it('enqueues through the given enqueue function and counts accepted alerts',async()=>{
  const enqueue=vi.fn(async(dedupeId:string)=>dedupeId.includes('block-a'));
  const count=await runPayoutDespiteBlockAlerts({loadEffects:async()=>[effect({payoutSince:5}),effect({payoutSince:5},{id:'other'}),effect({payoutSince:0},{id:'zero'})],enqueue,now:()=>new Date('2026-09-04T06:00:00Z')});
  expect(count).toBe(1);
  expect(enqueue).toHaveBeenCalledTimes(2);
  expect(enqueue.mock.calls[0][0]).toBe('payout_despite_block:block-a:2026-09-04');
 });
});

describe('Everflow read-only setting reader',()=>{
 it('reads the setting detail with relationships, maps 404 to null and throws on other errors',async()=>{
  const fetcher=vi.fn(async(url:string|URL|Request,init?:RequestInit)=>init?.method?new Response('write',{status:500}):String(url).includes('/777?')?new Response(JSON.stringify({network_custom_payout_revenue_setting_id:777}),{status:200}):String(url).includes('/404?')?new Response('',{status:404}):new Response('down',{status:503}));
  await expect(readEverflowSourceBlockSetting(777,'key',fetcher)).resolves.toMatchObject({network_custom_payout_revenue_setting_id:777});
  expect(String(fetcher.mock.calls[0][0])).toBe('https://api.eflow.team/v1/networks/custom/payoutrevenue/777?relationship=all');
  expect(fetcher.mock.calls[0][1]?.method).toBeUndefined();
  await expect(readEverflowSourceBlockSetting(404,'key',fetcher)).resolves.toBeNull();
  await expect(readEverflowSourceBlockSetting(500,'key',fetcher)).rejects.toThrow(/Everflow HTTP 503/);
  await expect(readEverflowSourceBlockSetting(777,'',fetcher)).rejects.toThrow(/EVERFLOW_API_KEY/);
  await expect(readEverflowSourceBlockSetting(0,'key',fetcher)).rejects.toThrow(/Setting-ID/);
 });
 it('adds only the reader to the Everflow module without touching activation or deactivation',()=>{
  const source=read('src/lib/everflow-source-blocks.ts');
  expect(source).toContain('export async function readEverflowSourceBlockSetting(');
  expect(source.indexOf('export async function readEverflowSourceBlockSetting(')).toBeGreaterThan(source.indexOf('export async function deactivateEverflowSourceBlock('));
  expect(source.match(/method:'PUT'/g)).toBeNull();
  expect(source.match(/method:'DELETE'/g)).toHaveLength(1);
  expect(source.match(/method:'POST'/g)).toHaveLength(2);
 });
});

describe('reconcile cron route and schedule',()=>{
 it('authenticates with the cron secret, holds its own lock, wraps everything in try/catch and never imports Everflow write paths',()=>{
  const route=read('src/app/api/source-blocks/reconcile/route.ts');
  expect(route).toContain('CRON_SECRET');
  expect(route).toContain("{error:'Nicht autorisiert'},401");
  expect(route).toContain('export const maxDuration=120');
  expect(route).toContain("acquireSecurityLease(store,SOURCE_BLOCK_RECONCILE_LOCK");
  expect(route).toContain('finally{await lease.release()}');
  expect(route).not.toContain('acquireHistorySyncLock');
  expect(route).not.toContain('activateEverflowSourceBlock');
  expect(route).not.toContain('deactivateEverflowSourceBlock');
  expect(route).toContain('readEverflowSourceBlockSetting');
  expect(route).toContain('runSourceBlockReconcile(');
  expect(route).toContain("reportingRange('30d')");expect(route).toContain('loadBlockEffects(effectsRange())');
  expect(route).toContain('enqueueSourceBlockManagerAlert');
  for(const key of['checked','ok','mismatch','unreachable','alerts','budgetExhausted'])expect(route).toContain(key);
  expect(route).toContain("console.error('Source block reconcile failed'");
  const lib=read('src/lib/source-block-reconcile.ts');
  expect(lib).not.toContain('activateEverflowSourceBlock');
  expect(lib).not.toContain('deactivateEverflowSourceBlock');
  expect(lib).not.toContain('sourceBlockStoreKey');
 });
 it('schedules the reconcile cron hourly after the reporting sync',()=>{
  const config=JSON.parse(read('vercel.json'))as{crons:Array<{path:string;schedule:string}>};
  expect(config.crons).toContainEqual({path:'/api/source-blocks/reconcile',schedule:'27 * * * *'});
 });
});

describe('source block balance page',()=>{
 it('reads the block effects module instead of computing violations itself and shows the balance columns, filters, totals and lazy history',()=>{
  const page=read('src/app/source-blocks/page.tsx');
  expect(page).toContain("reportingRange('30d')");expect(page).toContain('loadBlockEffects(effectsRange())');
  expect(page).not.toContain('summarizeSourceBlockViolations');
  expect(page).not.toContain('loadAffiliateSourceRowsRangeFromCache');
  expect(page).toContain('loadReconcileMarkers');
  expect(page).toContain("can(user.access,'finance.view')");
  expect(page).toContain("user.access.role!=='partner'&&can(user.access,'landingpages.manage')&&can(user.access,'api.manage')");
  for(const marker of['SOURCE_BLOCK_REASON_LABELS','ohne Kategorie','SOIs seit Sperre','Payout trotz Sperre','Letzter Traffic','Letzter Abgleich','Gesperrt seit','name="status"','name="category"','name="q"','sourceBlockSummary','showMoreSources','<SourceBlockHistoryPanel blockId={block.id}','<SourceBlockButton'])expect(page).toContain(marker);
  expect(page).toContain('PAGE_SIZE=100');
  const panel=read('src/app/source-blocks/SourceBlockHistoryPanel.tsx');
  expect(panel.startsWith("'use client'")).toBe(true);
  expect(panel).toContain('/api/source-blocks?action=history&id=');
  for(const marker of['reconcile_ok','reconcile_mismatch','activate_failed','Historie anzeigen'])expect(panel).toContain(marker);
 });
});
