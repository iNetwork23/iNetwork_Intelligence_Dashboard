import {beforeEach, expect, it, vi} from 'vitest';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {loadAffiliateConversionsFromCache} from './cached-evaluations';

const fixture = vi.hoisted(() => ({client: null as SupabaseClient | null}));
vi.mock('./supabase', () => ({getSupabaseAdmin: () => fixture.client}));
const requests: Array<{url: URL; signal: AbortSignal | null | undefined}> = [];
let responses: Array<{data: unknown; status?: number}>;
const timestamp = '2026-08-01T12:34:56.123456+00:00';
const now = new Date('2026-09-09T10:00:00Z');
const row = (i: number) => ({id: `id-${String(i).padStart(5, '0')}`, converted_at: timestamp, type: 'soi', lead_id: `tx-${i}`, raw: {transaction_id: `tx-${i}`, event: 'CPL SOI', traffic_mode: 'tracked'}});
const page = () => Array.from({length: 1000}, (_, i) => row(i));
beforeEach(() => {
  requests.length = 0;
  responses = [];
  fixture.client = createClient('https://wlx-fixture.invalid', 'test-key', {
    auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
    global: {fetch: async (input, init) => {
      requests.push({url: new URL(String(input)), signal: init?.signal});
      const response = responses.shift();
      if (!response) return new Response(JSON.stringify({message: 'Unexpected conversion request'}), {status: 400});
      return new Response(JSON.stringify(response.data), {status: response.status || 200, headers: {'content-type': 'application/json'}});
    }},
  });
});

it('continues timestamp ties by database ID without an increasing OFFSET and preserves every lead', async () => {
  responses = [{data: page()}, {data: [row(1000)]}];
  const result = await loadAffiliateConversionsFromCache('154', 90, now);
  expect(result).toHaveLength(1001);
  expect(new Set(result.map(item => item.transaction_id)).size).toBe(1001);
  expect(result[1000]).toMatchObject({event: 'SOI', stableCustomerId: 'tracked-transaction:tx-1000'});
  expect(requests).toHaveLength(2);
  for (const {url, signal} of requests) {
    expect(url.searchParams.get('affiliate_id')).toBe('eq.154');
    expect(url.searchParams.get('order')).toBe('converted_at.asc,id.asc');
    expect(url.searchParams.get('limit')).toBe('1000');
    expect(url.searchParams.has('offset')).toBe(false);
    expect(url.searchParams.get('select')).toBe('raw,type,lead_id,converted_at,id');
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(url.searchParams.get('or')).toContain('status.eq.approved,status.is.null');
    expect(url.searchParams.getAll('or')).toHaveLength(1);
  }
  expect(requests[0].url.searchParams.get('converted_at')).toBe('gte.2026-06-12T10:00:00.000Z');
  expect(requests[1].url.searchParams.get('converted_at')).toBe(`gte.${timestamp}`);
  expect(requests[1].url.searchParams.get('or')).toBe(`(and(or(status.eq.approved,status.is.null),or(converted_at.gt."${timestamp}",and(converted_at.eq."${timestamp}",id.gt."id-00999"))))`);
});

it('uses the last database row even when its raw event is filtered and escapes cursor literals', async () => {
  const first = page();
  first[999] = {...row(999), id: 'id-"quoted\\value,(x)', raw: {...row(999).raw, event: ''}};
  responses = [{data: first}, {data: [row(1000)]}];
  const result = await loadAffiliateConversionsFromCache('154', 90, now);
  expect(result).toHaveLength(1000);
  expect(requests[1].url.searchParams.get('or')).toContain('id.gt."id-\\"quoted\\\\value,(x)"');
  expect(result.at(-1)?.transaction_id).toBe('tx-1000');
});

it('fails closed on a later database error instead of accepting the first page', async () => {
  responses = [{data: page()}, {data: {message: 'canceling statement due to statement timeout', code: '57014'}, status: 500}];
  await expect(loadAffiliateConversionsFromCache('154', 90, now)).rejects.toThrow('Supabase affiliate conversions: canceling statement due to statement timeout');
});

it.each(['missing', 'invalid', 'unchanged'])('rejects a %s cursor without looping or returning partial data', async kind => {
  const first = page();
  if (kind === 'missing') first[999].id = '';
  if (kind === 'invalid') first[999].converted_at = 'not-a-date';
  responses = kind === 'unchanged' ? [{data: first}, {data: first}] : [{data: first}];
  await expect(loadAffiliateConversionsFromCache('154', 90, now)).rejects.toThrow('invalid or unchanged pagination cursor');
  expect(requests).toHaveLength(kind === 'unchanged' ? 2 : 1);
});

it('preserves API customer normalization and stops on an empty first page', async () => {
  const apiId = `api-customer-sha256:${'a'.repeat(64)}`;
  responses = [{data: [{...row(0), lead_id: apiId, raw: {...row(0).raw, traffic_mode: 'api'}}]}, {data: []}];
  expect((await loadAffiliateConversionsFromCache('154', 90, now))[0].stableCustomerId).toBe(apiId);
  expect(await loadAffiliateConversionsFromCache('6', 90, now)).toEqual([]);
  expect(requests).toHaveLength(2);
});
