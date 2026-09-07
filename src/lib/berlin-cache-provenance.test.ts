import {describe,expect,it,vi} from 'vitest';
import {loadPortfolioFromCache} from './supabase-reporting';
import {availableSourceSnapshotDays} from './affiliate-source-cache';
import {deriveDataStatus,headerStatus} from './data-status';
import {initialSyncState,runHistorySync,type SyncStore} from './history-cache';

const day='2026-07-01';
function client(version:number,timezoneId?:number){
 const tables:string[]=[],metricRead=vi.fn();
 const from=(table:string)=>{tables.push(table);const q={select:()=>q,eq:()=>q,gte:()=>q,lte:()=>q,order:()=>q,in:()=>q,range:async()=>{metricRead();return{data:[],error:null}},maybeSingle:async()=>({data:{value:{version:2,from:day,to:day,generation:'gen',rows:[]}},error:null}),then:(resolve:(v:unknown)=>void)=>resolve({data:[{value:{version,timezoneId,date:day,generation:'gen',rows:[]}}],error:null})};return q};
 return{from,rpc:vi.fn().mockResolvedValue({data:[],error:null}),tables,metricRead};
}
describe('Berlin cache provenance',()=>{
 it.each([[4,undefined],[5,80],[5,undefined]])('rejects old or foreign-timezone cache markers (%s,%s) before reading facts',async(version,timezoneId)=>{
  const db=client(version!,timezoneId);
  await expect(loadPortfolioFromCache('custom',db as never,new Date('2026-07-01T12:00Z'),{from:day,to:day})).rejects.toThrow('Berlin');
  expect(db.metricRead).not.toHaveBeenCalled();expect(db.rpc).not.toHaveBeenCalled();
 });
 it('accepts a complete Berlin day proof before reading its immutable range',async()=>{
  await expect(loadPortfolioFromCache('custom',client(5,56) as never,new Date('2026-07-01T12:00Z'),{from:day,to:day})).resolves.toHaveProperty('totals');
 });
 it('does not accept a source marker that has the new version but the old timezone',()=>{
  const markers=[{version:5,timezoneId:80,date:day,generation:'old'}];
  expect(availableSourceSnapshotDays({from:day,to:day},markers,{minimumVersion:5})).toEqual([]);
 });
 it('does not label old rolling history as live Berlin data',()=>{
  const now=new Date('2026-07-01T12:00Z'),state={...initialSyncState(now),snapshot_version:4,phase:'rolling' as const,last_success_at:now.toISOString()};
  expect(headerStatus(deriveDataStatus(state,now)).tone).toBe('warning');
 });
 it('restarts old history coverage without changing source timestamps or deleting records',async()=>{
  const now=new Date('2026-07-01T12:00Z'),old={...initialSyncState(now),snapshot_version:4,phase:'rolling' as const,last_success_at:now.toISOString()},save=vi.fn(),replace=vi.fn();
  const store:SyncStore={getState:async()=>old,upsertConversions:async()=>{},upsertMetrics:async()=>{},replaceMetrics:replace,setState:save};
  const result=await runHistorySync({store,now,loadConversions:async()=>[],loadReports:async()=>({base:[],events:[]})});
  expect(result.skipped).not.toBe(true);expect(save).toHaveBeenCalledWith(expect.objectContaining({snapshot_version:5,phase:'backfill'}));
 });
});
