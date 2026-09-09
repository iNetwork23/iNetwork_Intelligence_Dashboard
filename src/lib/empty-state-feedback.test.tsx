import React, {type ReactElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {parseAccessMetadata} from './rbac';

vi.mock('./session', () => ({currentUser: vi.fn()}));
vi.mock('./cohorts', () => ({getLtvCohorts: vi.fn(async () => [])}));
vi.mock('./dashboard-service', () => ({getDashboard: vi.fn(async () => ({affiliates: []}))}));
vi.mock('./data-status', () => ({getDataStatus: async () => ({}), ltvHeaderStatus: () => ({label: 'Test', tone: 'neutral'})}));
vi.mock('../app/affiliates/InstantLink', () => ({default: ({href, children}: {href: string; children: React.ReactNode}) => <a href={href}>{children}</a>}));

import {currentUser} from './session';
import CohortsPage from '../app/cohorts/page';
import AffiliateOptimizerPage from '../app/affiliates/page';

beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.mocked(currentUser).mockResolvedValue({id: 'qa', email: 'qa@example.invalid', actorId: 'qa', impersonating: false, access: parseAccessMetadata({role: 'super_admin'})});
});
afterEach(() => vi.unstubAllGlobals());

function emptyMarkup(page: ReactElement<{children: React.ReactNode}>) {
  const empty = React.Children.toArray(page.props.children).find(child => React.isValidElement<{className?: string}>(child) && child.props.className === 'smartEmpty');
  expect(empty).toBeDefined();
  return renderToStaticMarkup(empty as ReactElement);
}

it('describes a filtered cohort miss without claiming the initial import has not happened', async () => {
  const page = await CohortsPage({searchParams: Promise.resolve({source: 'does-not-exist', affiliate: '6', period: '7d'})});
  const html = emptyMarkup(page);
  expect(html).toContain('Keine Kohorten für diese Filter');
  expect(html).toContain('Filter ändern oder zurücksetzen');
  expect(html).not.toContain('ersten erfolgreichen Sync');
  const form = React.Children.toArray(page.props.children).find(child => React.isValidElement(child) && child.type === 'form') as ReactElement;
  expect(renderToStaticMarkup(form)).toContain('href="/cohorts?period=7d"');
});

it.each([{}, {source: '  ', sub_source: ' ', affiliate: ' '}])('keeps initial-import guidance when no effective cohort filter exists: %j', async filters => {
  const html = emptyMarkup(await CohortsPage({searchParams: Promise.resolve(filters)}));
  expect(html).toContain('Noch keine Kohorten vorhanden');
  expect(html).toContain('ersten erfolgreichen Sync');
});

it('explains the Smartlink permissions when a partner lacks finance access', async () => {
  vi.mocked(currentUser).mockResolvedValue({id: 'qa', email: 'qa@example.invalid', actorId: 'qa', impersonating: false, access: parseAccessMetadata({role: 'partner', scopes: {affiliate: ['6'], campaign: ['2']}})});
  const html = renderToStaticMarkup(await AffiliateOptimizerPage({searchParams: Promise.resolve({mode: 'smartlinks', affiliate: '6', campaign: '2'})}));
  expect(html).toContain('403');
  expect(html).toContain('smartlinks.view und finance.view');
  expect(html).not.toContain('Fehlende Berechtigung: partners.view');
});

it('retains the partner-directory denial outside Smartlink mode', async () => {
  vi.mocked(currentUser).mockResolvedValue({id: 'qa', email: 'qa@example.invalid', actorId: 'qa', impersonating: false, access: parseAccessMetadata({role: 'partner', scopes: {affiliate: ['6']}})});
  const html = renderToStaticMarkup(await AffiliateOptimizerPage({searchParams: Promise.resolve({mode: 'direct'})}));
  expect(html).toContain('403');
  expect(html).toContain('Fehlende Berechtigung: partners.view');
});
