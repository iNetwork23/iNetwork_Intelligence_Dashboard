import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {SyncState} from './history-cache';

vi.mock('server-only',()=>({}));
vi.mock('next/cache',()=>({unstable_cache:(load:()=>unknown)=>load}));
const inFilter=vi.fn();
const select=vi.fn(()=>({in:inFilter}));
const from=vi.fn(()=>({select}));
vi.mock('./supabase',()=>({getSupabaseAdmin:()=>({from})}));

const read=(path:string)=>readFileSync(join(process.cwd(),'src',path),'utf8');
const now=new Date('2026-09-03T12:20:00Z');
const rolling:SyncState={phase:'rolling',backfill_start:'2025-09-04',next_end:'2025-09-04',last_success_at:'2026-09-03T12:17:00Z',last_hot_at:'2026-09-03T12:17:00Z',snapshot_version:3};

describe('deriveDataStatus',()=>{
 it('reports a fresh rolling sync with today as a partial day',async()=>{
  const {deriveDataStatus,headerStatus,describeDataStatus}=await import('./data-status');
  const status=deriveDataStatus(rolling,now);
  expect(status).toMatchObject({syncAt:'2026-09-03T12:17:00Z',syncAgeMinutes:3,phase:'rolling',backfillDone:365,backfillTotal:365,todayPartial:true,level:'ok',ltv:{refreshedAt:null,failed:false},fraudCutoverReady:false});
  expect(headerStatus(status)).toEqual({label:'Sync 14:17',tone:'live'});
  expect(describeDataStatus(status)).toEqual({primary:'Everflow-Sync 14:17 · vor 3 min · heute Teiltag bis 14:17',ltv:null});
 });
 it('marks a sync older than 90 minutes as stale with an hour-based age',async()=>{
  const {deriveDataStatus,headerStatus,describeDataStatus}=await import('./data-status');
  const status=deriveDataStatus({...rolling,last_success_at:'2026-09-03T09:00:00Z'},now);
  expect(status.syncAgeMinutes).toBe(200);
  expect(status.level).toBe('stale');
  expect(headerStatus(status)).toEqual({label:'Sync vor 3 h',tone:'warning'});
  expect(describeDataStatus(status).primary).toBe('Letzter erfolgreicher Sync vor 3 h – Zahlen können veraltet sein');
 });
 it('keeps 90 minutes itself fresh and treats 91 minutes as stale',async()=>{
  const {deriveDataStatus}=await import('./data-status');
  expect(deriveDataStatus({...rolling,last_success_at:'2026-09-03T10:50:00Z'},now).level).toBe('ok');
  expect(deriveDataStatus({...rolling,last_success_at:'2026-09-03T10:49:00Z'},now).level).toBe('stale');
 });
 it('uses the Berlin calendar day for the partial-day flag',async()=>{
  const {deriveDataStatus}=await import('./data-status');
  const status=deriveDataStatus({...rolling,last_success_at:'2026-09-03T21:30:00Z'},new Date('2026-09-03T22:30:00Z'));
  expect(status.level).toBe('ok');
  expect(status.todayPartial).toBe(false);
 });
 it('derives backfill progress from backfill_start and next_end',async()=>{
  const {deriveDataStatus,headerStatus,describeDataStatus}=await import('./data-status');
  const status=deriveDataStatus({phase:'backfill',backfill_start:'2025-09-04',next_end:'2026-02-03',last_success_at:'2026-09-03T12:10:00Z'},now);
  expect(status).toMatchObject({phase:'backfill',backfillDone:212,backfillTotal:365,todayPartial:false,level:'ok'});
  expect(headerStatus(status)).toEqual({label:'Backfill 212/365',tone:'neutral'});
  expect(describeDataStatus(status).primary).toBe('Backfill 212/365 Tage · heute alle 6 h');
  expect(deriveDataStatus({phase:'backfill',backfill_start:'2025-09-04',next_end:'2026-09-03',last_success_at:'2026-09-03T12:10:00Z'},now).backfillDone).toBe(0);
  expect(deriveDataStatus({phase:'backfill',backfill_start:'2025-09-04',next_end:'2025-09-04',last_success_at:'2026-09-03T12:10:00Z'},now).backfillDone).toBe(364);
 });
 it('lets a stale backfill warn instead of showing neutral progress',async()=>{
  const {deriveDataStatus,headerStatus}=await import('./data-status');
  const status=deriveDataStatus({phase:'backfill',backfill_start:'2025-09-04',next_end:'2026-02-03',last_success_at:'2026-09-02T12:10:00Z'},now);
  expect(status.level).toBe('stale');
  expect(headerStatus(status).tone).toBe('warning');
 });
 it('falls back to unknown without a readable state',async()=>{
  const {deriveDataStatus,headerStatus,describeDataStatus}=await import('./data-status');
  const status=deriveDataStatus(null,now);
  expect(status).toEqual({syncAt:null,syncAgeMinutes:null,phase:null,backfillDone:null,backfillTotal:365,todayPartial:false,ltv:{refreshedAt:null,failed:false},fraudCutoverReady:false,level:'unknown'});
  expect(headerStatus(status)).toEqual({label:'Sync unbekannt',tone:'warning'});
  expect(describeDataStatus(status)).toEqual({primary:'Sync-Status nicht lesbar',ltv:null});
  expect(deriveDataStatus({...rolling,last_success_at:null},now).level).toBe('unknown');
  expect(deriveDataStatus({...rolling,last_success_at:'garbage'},now).level).toBe('unknown');
 });
 it('carries LTV refresh state and fraud cutover readiness',async()=>{
  const {deriveDataStatus,describeDataStatus}=await import('./data-status');
  const ready=deriveDataStatus(rolling,now,{ltv:{status:'ready',refreshed_at:'2026-09-03T11:25:00Z'},fraud:{phase:'rolling',readyAt:'2026-09-01T00:00:00Z'}});
  expect(ready.ltv).toEqual({refreshedAt:'2026-09-03T11:25:00Z',failed:false});
  expect(ready.fraudCutoverReady).toBe(true);
  expect(describeDataStatus(ready).ltv).toBe('LTV-Kohorten 13:25');
  const failed=deriveDataStatus(rolling,now,{ltv:{status:'failed',failed_at:'2026-09-03T11:25:00Z',error:'refresh_timeout'},fraud:{phase:'backfill',readyAt:null}});
  expect(failed.ltv).toEqual({refreshedAt:null,failed:true});
  expect(failed.fraudCutoverReady).toBe(false);
  expect(describeDataStatus(failed).ltv).toBe('LTV-Refresh fehlgeschlagen');
 });
});

describe('getDataStatus',()=>{
 beforeEach(()=>{from.mockClear();select.mockClear();inFilter.mockReset()});
 it('reads the three sync_state keys with a single select and never writes',async()=>{
  inFilter.mockResolvedValue({data:[{key:'everflow_history',value:{...rolling,last_success_at:new Date(Date.now()-2*60_000).toISOString()}},{key:'ltv_cohorts_materialized',value:{status:'ready',refreshed_at:'2026-09-03T11:25:00Z'}}],error:null});
  const {getDataStatus}=await import('./data-status');
  const status=await getDataStatus();
  expect(from).toHaveBeenCalledWith('sync_state');
  expect(select).toHaveBeenCalledWith('key,value');
  expect(inFilter).toHaveBeenCalledWith('key',['everflow_history','ltv_cohorts_materialized','fraud_conversion_backfill_v3']);
  expect(status.level).toBe('ok');
  expect(status.ltv.refreshedAt).toBe('2026-09-03T11:25:00Z');
  expect(status.fraudCutoverReady).toBe(false);
 });
 it('never breaks the page when the read fails',async()=>{
  inFilter.mockResolvedValue({data:null,error:{message:'connection refused'}});
  const {getDataStatus}=await import('./data-status');
  await expect(getDataStatus()).resolves.toMatchObject({level:'unknown',syncAt:null});
  inFilter.mockRejectedValue(new Error('network'));
  await expect(getDataStatus()).resolves.toMatchObject({level:'unknown'});
 });
 it('returns unknown when the history key is missing',async()=>{
  inFilter.mockResolvedValue({data:[],error:null});
  const {getDataStatus}=await import('./data-status');
  await expect(getDataStatus()).resolves.toMatchObject({level:'unknown',phase:null});
 });
});

describe('data status wiring',()=>{
 it('caches the sync_state read for 60 seconds under the data-status tag',()=>{
  const source=read('lib/data-status.ts');
  for(const marker of['unstable_cache','revalidate:60',"tags:['data-status']","from('sync_state')","select('key,value')"])expect(source).toContain(marker);
  expect(source).not.toContain('upsert');
  expect(source).not.toContain('.rpc(');
 });
 it('renders a compact status bar with a machine-readable level',()=>{
  const bar=read('app/components/DataStatusBar.tsx');
  for(const marker of['getDataStatus','describeDataStatus','role="status"','data-level={','dataStatusBar'])expect(bar).toContain(marker);
  const header=read('app/components/DashboardPageHeader.tsx');
  expect(header).toContain("'warning'");
  const css=read('app/globals.css');
  for(const marker of['.dashboardPageStatus.warning{','.dashboardPageStatus.warning i{','.dataStatusBar{','.dataStatusBar.warning{'])expect(css).toContain(marker);
 });
});
