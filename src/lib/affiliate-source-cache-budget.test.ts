import {expect, it, vi} from 'vitest';
import {parseAccessMetadata} from './rbac';
import {getAffiliateSourceBreakdown} from './affiliate-optimizer-service';

const state = vi.hoisted(() => ({oversized: [] as Array<{keys: string[]; bytes: number}>}));
vi.mock('next/cache', () => ({unstable_cache: (load: () => unknown, keys: string[]) => async () => {
  const value = await load(), bytes = Buffer.byteLength(JSON.stringify(value));
  if (bytes > 2 * 1024 * 1024) state.oversized.push({keys, bytes});
  return value;
}}));
vi.mock('./cached-evaluations', () => ({
  loadAffiliateSourceRowsRangeFromCache: async () => Array.from({length: 700}, () => ({
    columns: [
      {column_type: 'date', id: '2026-09-01', label: '2026-09-01'},
      {column_type: 'affiliate', id: '154', label: 'Partner'},
      {column_type: 'offer', id: '8', label: 'Offer '.repeat(700)},
      {column_type: 'campaign', id: '0', label: 'Direct'},
      {column_type: 'offer_url', id: '5', label: 'LP'},
      {column_type: 'traffic_mode', id: 'tracked', label: 'tracked'},
      {column_type: 'source_id', id: 'source', label: 'source'},
      {column_type: 'sub1', id: 'sub', label: 'sub'},
    ],
    reporting: {total_click: 2, cv: 1, first_sales: 0, rebills: 0, coin_spend: 0, payout: 1, revenue: 2, profit: 1},
  })),
  loadAffiliateConversionsFromCache: async () => [],
  loadAffiliateActivityIndex: async () => [],
  loadSourceSnapshotFreshness: async () => ({complete: true, availableDays: 365, expectedDays: 365, minDate: '2025-09-08', maxDate: '2026-09-07', generatedAt: '2026-09-07T11:00:00Z'}),
}));
vi.mock('./supabase', () => ({getSupabaseAdmin: () => {throw new Error('Unexpected database call');}}));

it('aggregates large repeated snapshot metadata before attempting persistent caching', async () => {
  const access = parseAccessMetadata({role: 'admin', status: 'active', grants: [], denials: [], version: 1, scopes: {}});
  const rows = await getAffiliateSourceBreakdown('154', {from: '2026-08-09', to: '2026-09-07'}, access, new Date('2026-09-07T12:00:00Z'));
  expect(rows).toHaveLength(1);
  expect(rows[0].days30).toMatchObject({clicks: 1400, sois: 700, revenue: 1400, payout: 700, profit: 700});
  expect(state.oversized).toEqual([]);
});
