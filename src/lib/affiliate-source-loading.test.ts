import {beforeEach, expect, it, vi} from 'vitest';
import {loadAffiliateSourceRowsRangeFromCache} from './cached-evaluations';

const state = vi.hoisted(() => ({batches: [] as string[][], signals: [] as AbortSignal[], active: 0, peak: 0, failDay: '', malformedDay: '', missingDay: '', emptyDay: ''}));
const day = (n: number) => `2026-08-${String(n).padStart(2, '0')}`;
vi.mock('./supabase', () => ({getSupabaseAdmin: () => ({from: () => {
  let keys: string[] | undefined;
  const query = {
    select: () => query, gte: () => query, lte: () => query, order: () => query,
    in: (_field: string, values: string[]) => {keys = values; return query;},
    abortSignal: (signal: AbortSignal) => {state.signals.push(signal); return query;},
    then: async (resolve: (value: unknown) => unknown) => {
      if (!keys) return resolve({data: Array.from({length: 19}, (_, i) => ({value: {version: i === 18 ? 4 : 5, timezoneId: 56, date: day(i + 1), generation: `g${i + 1}`}})), error: null});
      state.batches.push(keys);
      state.active++;
      state.peak = Math.max(state.peak, state.active);
      await Promise.resolve();
      state.active--;
      if (keys.length > 8 || (state.failDay && keys.some(key => key.includes(state.failDay)))) return resolve({data: null, error: {message: 'canceling statement due to statement timeout'}});
      return resolve({data: keys.filter(key => !state.missingDay || !key.includes(state.missingDay)).map(key => ({value: {date: key.split(':')[1], affiliate_id: '154', affiliate_name: 'Partner', rows: key.includes(state.malformedDay || 'no-malformed-day') ? null : key.includes(state.emptyDay || 'no-empty-day') ? [] : [
        {o: '50', on: 'Offer', c: '0', cn: 'Direct', u: '5', un: 'LP', s: 'source', ss: 'sub', m: 'tracked', s1: 'sub', cl: 2, cv: 1, fs: 0, rb: 0, cs: 0, p: 1, r: 2, pr: 1},
      ]}})), error: null});
    },
  };
  return query;
}})}));
beforeEach(() => {state.batches = []; state.signals = []; state.active = 0; state.peak = 0; state.failDay = ''; state.malformedDay = ''; state.missingDay = ''; state.emptyDay = '';});
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
  expect(state.batches).toHaveLength(2);
  expect(state.batches.flat()).not.toContain('source_day:2026-08-17:g17:154');
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
