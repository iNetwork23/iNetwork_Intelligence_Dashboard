import {beforeEach, expect, it, vi} from 'vitest';
import {loadAffiliateSourceRowsRangeFromCache,loadAffiliateActivityIndex} from './cached-evaluations';

const state = vi.hoisted(() => ({batches: [] as string[][], signals: [] as AbortSignal[], active: 0, peak: 0, failDay: '', malformedDay: '', missingDay: '', emptyDay: '', batchLimit:8, failure:'canceling statement due to statement timeout'}));
const day = (n: number) => `2026-08-${String(n).padStart(2, '0')}`;
const writes=vi.hoisted(()=>vi.fn<(...args:unknown[])=>Promise<{error:null}>>(async()=>({error:null})));
vi.mock('./supabase', () => ({getSupabaseAdmin: () => ({from: () => {
  let keys: string[] | undefined;
  const query = {
    select: () => query, gte: () => query, lte: () => query, order: () => query,eq:()=>query,maybeSingle:async()=>({data:null,error:null}),upsert:writes,
    in: (_field: string, values: string[]) => {keys = values; return query;},
    abortSignal: (signal: AbortSignal) => {state.signals.push(signal); return query;},
    then: async (resolve: (value: unknown) => unknown) => {
      if (!keys) return resolve({data: Array.from({length: 19}, (_, i) => ({value: {version: i === 18 ? 4 : 5, timezoneId: 56, date: day(i + 1), generation: `g${i + 1}`}})), error: null});
      if(keys.every(key=>key.startsWith('source_activity_day:')))return resolve({data:[],error:null});
      state.batches.push(keys);
      state.active++;
      state.peak = Math.max(state.peak, state.active);
      await Promise.resolve();
      state.active--;
      if (keys.length > state.batchLimit || (state.failDay && keys.some(key => key.includes(state.failDay)))) return resolve({data: null, error: {message: state.failure}});
      return resolve({data: keys.filter(key => !state.missingDay || !key.includes(state.missingDay)).map(key => ({value: {date: key.split(':')[1], affiliate_id: '154', affiliate_name: 'Partner', rows: key.includes(state.malformedDay || 'no-malformed-day') ? null : key.includes(state.emptyDay || 'no-empty-day') ? [] : [
        {o: '50', on: 'Offer', c: '0', cn: 'Direct', u: '5', un: 'LP', s: 'source', ss: 'sub', m: 'tracked', s1: 'sub', cl: 2, cv: 1, fs: 0, rb: 0, cs: 0, p: 1, r: 2, pr: 1},
      ]}})), error: null});
    },
  };
  return query;
}})}));
beforeEach(() => {writes.mockClear();state.batches = []; state.signals = []; state.active = 0; state.peak = 0; state.failDay = ''; state.malformedDay = ''; state.missingDay = ''; state.emptyDay = '';state.batchLimit=8;state.failure='canceling statement due to statement timeout';});
const range = {from: '2026-08-01', to: '2026-08-19'};

it('reads every accepted affiliate day once within the response budget and preserves totals', async () => {
  const rows = await loadAffiliateSourceRowsRangeFromCache(range, '154');
  expect(rows).toHaveLength(18);
  expect(rows.reduce((sum, row) => sum + row.reporting.cv, 0)).toBe(18);
  expect(rows.reduce((sum, row) => sum + row.reporting.revenue, 0)).toBe(36);
  expect(rows.map(row => row.columns.find(column => column.column_type === 'date')?.id).sort()).toEqual(Array.from({length: 18}, (_, i) => day(i + 1)));
  expect(state.batches.flat().sort()).toEqual(Array.from({length: 18}, (_, i) => `source_day:${day(i + 1)}:g${i + 1}:154`).sort());
  expect(state.batches.every(batch => batch.length <= 8)).toBe(true);
  expect(state.peak).toBe(1);
  expect(state.signals).toHaveLength(state.batches.length);
  expect(state.signals.every(signal => signal instanceof AbortSignal)).toBe(true);
});

it('rejects a later failed batch instead of publishing partial history as complete', async () => {
  state.failDay = '2026-08-09';
  await expect(loadAffiliateSourceRowsRangeFromCache(range, '154')).rejects.toThrow('Supabase source snapshots: canceling statement due to statement timeout');
  expect(state.batches.map(batch=>batch.length)).toEqual([8,8,4,2,1]);
  expect(state.batches.flat()).not.toContain('source_day:2026-08-17:g17:154');
});

it('adapts to large snapshots without dropping or duplicating accepted rows',async()=>{
  state.batchLimit=2;
  const rows=await loadAffiliateSourceRowsRangeFromCache(range,'154');
  expect(rows).toHaveLength(18);
  expect(rows.reduce((sum,row)=>sum+row.reporting.cv,0)).toBe(18);
  expect(rows.reduce((sum,row)=>sum+row.reporting.revenue,0)).toBe(36);
  expect(state.batches.slice(0,3).map(batch=>batch.length)).toEqual([8,4,2]);
  expect(state.batches.slice(2).flat()).toHaveLength(18);
  expect(state.peak).toBe(1);
});

it('does not retry a permission or general database failure as a size problem',async()=>{
  state.failDay='2026-08-09';state.failure='permission denied';
  await expect(loadAffiliateSourceRowsRangeFromCache(range,'154')).rejects.toThrow('permission denied');
  expect(state.batches).toHaveLength(2);
});

it('rejects a malformed snapshot after valid days instead of silently accepting partial history', async () => {
  state.malformedDay = '2026-08-09';
  await expect(loadAffiliateSourceRowsRangeFromCache(range, '154')).rejects.toThrow('Supabase source snapshots: invalid snapshot');
});
it('accepts absent affiliate-day records and explicitly empty snapshots', async () => {
  state.missingDay = '2026-08-09'; state.emptyDay = '2026-08-10';
  const rows = await loadAffiliateSourceRowsRangeFromCache(range, '154');
  expect(rows).toHaveLength(16);
  expect(rows.reduce((sum, row) => sum + row.reporting.cv, 0)).toBe(16);
});
it('builds identical annual activity with bounded batch reads instead of one round trip per day',async()=>{
 const entries=await loadAffiliateActivityIndex('154',range);
 expect(entries).toHaveLength(1);expect(entries[0].lastLeadDate).toBe('2026-08-18');
 expect(state.batches).toHaveLength(3);expect(state.batches.every(batch=>batch.length<=8)).toBe(true);expect(state.peak).toBe(1);
 expect(writes).toHaveBeenCalledWith(expect.objectContaining({value:expect.objectContaining({entries:[['50','154','5','tracked','source','sub','2026-08-18']]})}),{onConflict:'key'});
});
it('does not publish an annual activity memo after a later malformed day',async()=>{
 state.malformedDay='2026-08-09';await expect(loadAffiliateActivityIndex('154',range)).rejects.toThrow('invalid snapshot');
 // Valid earlier daily summaries may remain; no partial annual result is published.
 expect(writes.mock.calls.some(call=>!Array.isArray(call[0]))).toBe(false);
});

it('shrinks large activity reads and still preserves every accepted day',async()=>{
 state.batchLimit=2;
 const entries=await loadAffiliateActivityIndex('154',range);
 expect(entries).toHaveLength(1);expect(entries[0].lastLeadDate).toBe('2026-08-18');
 expect(state.batches.slice(0,3).map(batch=>batch.length)).toEqual([8,4,2]);
 expect(state.batches.slice(2).flat()).toHaveLength(18);expect(state.peak).toBe(1);
});
it('does not retry an activity permission failure or publish an annual result',async()=>{
 state.failDay='2026-08-09';state.failure='permission denied';
 await expect(loadAffiliateActivityIndex('154',range)).rejects.toThrow('permission denied');
 expect(state.batches).toHaveLength(2);
 expect(writes.mock.calls.some(call=>!Array.isArray(call[0]))).toBe(false);
});
