import {describe,expect,it,vi} from 'vitest';
import {refreshHistoryRange,type SyncStore,type EverflowConversion} from './history-cache';

describe('metric replacement window contract',()=>{
 const seed=(day:string):EverflowConversion=>({conversion_id:day,transaction_id:day,conversion_unix_timestamp:Date.parse(`${day}T12:00Z`)/1000,is_event:false,event:'SOI'});
 const makeStore=()=>({getState:async()=>null,upsertConversions:vi.fn(),upsertMetrics:vi.fn(),replaceMetrics:vi.fn(),setState:vi.fn()} satisfies SyncStore);
 it('replaces a longer manual range in sequential bounded windows without dropping empty days or duplicating events',async()=>{
  const store=makeStore(),rows=[seed('2026-07-01'),seed('2026-07-04'),seed('2026-07-07')];
  const result=await refreshHistoryRange({store,from:'2026-07-01',to:'2026-07-07',loadConversions:async()=>rows,loadReports:async()=>({base:[],events:[]})});
  expect(store.replaceMetrics.mock.calls.map(([from,to,metrics])=>[from,to,metrics.map((r:{metric_date:string})=>r.metric_date)])).toEqual([
   ['2026-07-01','2026-07-03',['2026-07-01']],['2026-07-04','2026-07-06',['2026-07-04']],['2026-07-07','2026-07-07',['2026-07-07']],
  ]);
  expect(store.upsertConversions).toHaveBeenCalledOnce();expect(result.conversions).toHaveLength(3);expect(result.metrics.reduce((n,row)=>n+row.sois,0)).toBe(3);
 });
 it('rejects a conversion outside the Berlin window before any persistence',async()=>{
  const store=makeStore();
  await expect(refreshHistoryRange({store,from:'2026-07-01',to:'2026-07-01',loadConversions:async()=>[seed('2026-07-02')],loadReports:async()=>({base:[],events:[]})})).rejects.toThrow('Berlin');
  expect(store.upsertConversions).not.toHaveBeenCalled();expect(store.replaceMetrics).not.toHaveBeenCalled();
 });
 it('stops on a failed replacement and never advances the history state',async()=>{
  const store=makeStore();store.replaceMetrics.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('database unavailable'));
  await expect(refreshHistoryRange({store,from:'2026-07-01',to:'2026-07-07',loadConversions:async()=>[],loadReports:async()=>({base:[],events:[]})})).rejects.toThrow('database unavailable');
  expect(store.replaceMetrics).toHaveBeenCalledTimes(2);expect(store.setState).not.toHaveBeenCalled();
 });
});
