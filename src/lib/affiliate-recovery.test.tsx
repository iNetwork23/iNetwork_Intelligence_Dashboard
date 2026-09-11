// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot, hydrateRoot, type Root} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {IncompleteBerlinReportingRangeError} from './berlin-reporting-contract';
import {parseAccessMetadata} from './rbac';
import AffiliateOptimizerPage from '../app/affiliates/page';
import LanguageProvider from '../app/components/LanguageProvider';

const state = vi.hoisted(() => ({failure: null as unknown, user: null as unknown, query: '', push: vi.fn(), load: vi.fn()}));
vi.mock('./session', () => ({currentUser: async () => state.user}));
vi.mock('./affiliate-optimizer-service', () => ({
  getAffiliateOptimizationsWithTrend: (...args: unknown[]) => {state.load(...args); return Promise.reject(state.failure);},
  getAffiliateLastLeadDates: async () => ({}), getPortfolioDailyByVariant: async () => ({}),
  getAffiliateDailyByKey: async () => ({}), getAffiliateSourceBreakdown: async () => [],
  getAffiliateSourceFreshness: async () => null,
}));
vi.mock('./smartlink-service', () => ({getCampaignAffiliateMappings: async () => [], getCampaignDirectory: async () => []}));
vi.mock('./rebill-concentration-service', () => ({getAffiliateRebillEvents: async () => []}));
vi.mock('./block-effects', () => ({loadBlockIndex: async () => new Map()}));
vi.mock('next/navigation', () => ({
  redirect: (href: string) => {throw new Error('REDIRECT ' + href);},
  usePathname: () => '/affiliates', useSearchParams: () => new URLSearchParams(state.query), useRouter: () => ({push: state.push}),
}));

let host: HTMLDivElement, root: Root | undefined;
beforeEach(() => {
  vi.stubGlobal('React', React); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  state.failure = new Error('Database unavailable private-fixture-detail');
  state.user = {id: 'fixture', access: parseAccessMetadata({role: 'super_admin'})};
  state.push.mockClear(); state.load.mockClear(); document.documentElement.dataset.locale = 'de';
  host = document.createElement('div'); document.body.append(host);
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount()); root = undefined; host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
async function mount(query: Record<string, string>, hash = '', hydrate = false) {
  state.query = new URLSearchParams(query).toString();
  window.history.replaceState({}, '', '/affiliates?' + state.query + hash);
  const tree = <LanguageProvider>{await AffiliateOptimizerPage({searchParams: Promise.resolve(query)})}</LanguageProvider>;
  const onRecoverableError = vi.fn();
  if (hydrate) {
    host.innerHTML = renderToString(tree);
    await act(async () => {root = hydrateRoot(host, tree, {onRecoverableError});});
    expect(onRecoverableError).not.toHaveBeenCalled();
  } else await act(async () => {root = createRoot(host); root.render(tree);});
}
const retry = () => [...host.querySelectorAll<HTMLAnchorElement>('a')].find(a => /Erneut versuchen|Try again/.test(a.textContent || ''));

describe('affiliate recovery without losing the selected workspace', () => {
  it('retains Direct offer, source range, search, sort and open rows in a full reload link', async () => {
    const query = {affiliate: '42', offer: '9', mode: 'direct', period: 'custom', from: '2026-08-10', to: '2026-08-16', sourcePeriod: 'custom', sourceFrom: '2026-08-01', sourceTo: '2026-08-07', sourceSort: 'cvr', sourceOpen: 'url-77,source-tracked-Example', q: 'A&B', latency: '1'};
    await mount(query, '#url-77');
    expect(Object.fromEntries(new URL(retry()!.href).searchParams)).toEqual(query);
    expect(new URL(retry()!.href).hash).toBe('#url-77');
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.textContent).not.toContain('private-fixture-detail');
  });
  it('retains Campaign and selected landing page without repeating force-refresh flags', async () => {
    const query = {affiliate: '42', mode: 'smartlinks', campaign: '7', partner: '42', open: '7', period: 'calendar', calendarYear: '2026', calendarMonth: '08', sourcePeriod: '7d'};
    await mount({...query, refresh: '1', ts: '12345', unrelated: 'discard'}, '#lp-detail-7-77');
    expect(Object.fromEntries(new URL(retry()!.href).searchParams)).toEqual(query);
    expect(new URL(retry()!.href).hash).toBe('#lp-detail-7-77');
  });
  it('allows a shorter period while preserving partner and source context after a coverage failure', async () => {
    state.failure = new IncompleteBerlinReportingRangeError(380, 403);
    await mount({affiliate: '42', mode: 'direct', offer: '9', period: 'custom', from: '2025-08-05', to: '2026-09-11', sourcePeriod: '7d'});
    expect(host.textContent).toContain('Zeitraum noch nicht vollständig verfügbar');
    expect(host.textContent).not.toContain('403 · Scope');
    const week = [...host.querySelectorAll('button')].find(b => b.textContent === '7 Tage');
    expect(week).toBeDefined(); await act(async () => week!.click());
    expect(state.push).toHaveBeenCalledWith('/affiliates?affiliate=42&mode=direct&offer=9&sourcePeriod=7d&period=7d', {scroll: false});
    expect(host.querySelector('.affiliateCockpit, .urlDecisionTable')).toBeNull();
  });
  it('renders complete English recovery labels after hydration', async () => {
    document.documentElement.dataset.locale = 'en';
    await mount({affiliate: '42', mode: 'direct', period: '30d'}, '', true);
    expect(host.textContent).toContain('Affiliate Optimizer could not be loaded');
    expect(host.textContent).toContain('The data source is temporarily unavailable.');
    expect(retry()?.textContent).toBe('Try again');
    expect(host.textContent).not.toContain('Erneut versuchen');
  });
  it('keeps rejected custom dates editable and does not retry an invalid range', async () => {
    await mount({affiliate: '42', mode: 'direct', period: 'custom', from: '2026-08-20', to: '2026-08-10'});
    expect(host.textContent).toContain('Ungültiger Zeitraum');
    expect(host.querySelector<HTMLInputElement>('input[name="from"]')?.value).toBe('2026-08-20');
    expect(host.querySelector<HTMLInputElement>('input[name="to"]')?.value).toBe('2026-08-10');
    expect(retry()).toBeUndefined();
  });
  it('keeps actual scope failures fail-closed without a retry or period controls', async () => {
    state.failure = new Error('403 scope verification failed');
    await mount({affiliate: '42', mode: 'direct'});
    expect(host.textContent).toContain('403 · Scope nicht sicher auswertbar');
    expect(retry()).toBeUndefined(); expect(host.querySelector('.periodControls')).toBeNull();
  });
  it('checks authentication and foreign scope before loading or offering recovery', async () => {
    state.user = null; await expect(mount({mode: 'direct'})).rejects.toThrow('REDIRECT /login');
    state.user = {id: 'fixture', access: parseAccessMetadata({role: 'employee', scopes: {affiliate: ['42']}})};
    await mount({affiliate: '99', mode: 'direct'});
    expect(host.textContent).toContain('403 · Fremde ID');
    expect(state.load).not.toHaveBeenCalled(); expect(retry()).toBeUndefined();
  });
});
