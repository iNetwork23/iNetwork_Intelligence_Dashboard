import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';
const read=(path:string)=>readFileSync(join(process.cwd(),'src/app',path),'utf8');

const routes=['page.tsx','affiliates/page.tsx','automation/page.tsx','cohorts/page.tsx','admin/access/page.tsx','settings/security/page.tsx'];

describe('shared professional dashboard header system',()=>{
 it('uses one reusable header across every protected dashboard page',()=>{
  for(const route of routes){const source=read(route);expect(source).toContain('<DashboardPageHeader');expect(source).not.toContain('className="topbar"')}
  expect(read('smartlinks/page.tsx')).toContain('legacySmartlinkRedirectHref');
 });
 it('defines a compact hierarchy with semantic status and page-specific iconography',()=>{
  const source=read('components/DashboardPageHeader.tsx');
  for(const marker of['dashboardPageHeader','dashboardPageIcon','dashboardPageKicker','dashboardPageTitle','dashboardPageStatus','dashboardPageDescription'])expect(source).toContain(marker);
  for(const icon of['monitor','affiliate','smartlink','automation','cohorts','access','security'])expect(source).toContain(`"${icon}"`);
 });
 it('computes the account monitor status from the real sync state instead of a hardcoded live badge',()=>{
  const page=read('page.tsx');
  expect(page).not.toContain('status="Live"');
  expect(page).not.toContain('Cache: 60');
  for(const marker of['getDataStatus','headerStatus(','status={header.label}','tone={header.tone}','<DataStatusBar'])expect(page).toContain(marker);
  expect(page).toContain('Persistenter Supabase-Cache');
 });
 it('computes the remaining page headers from the real sync state and reads it once per page',()=>{
  for(const route of['affiliates/page.tsx','automation/page.tsx']){const page=read(route);expect(page).not.toContain('status="Live"');for(const marker of['headerStatus(','status={header.label}','tone={header.tone}','<DataStatusBar status={dataStatus}'])expect(page,route).toContain(marker);expect(page.match(/getDataStatus\(/g),route).toHaveLength(1)}
  const cohorts=read('cohorts/page.tsx');expect(cohorts).not.toContain('status="Aktuell"');for(const marker of['ltvHeaderStatus(','status={header.label}','tone={header.tone}','<DataStatusBar status={dataStatus}'])expect(cohorts).toContain(marker);expect(cohorts.match(/getDataStatus\(/g)).toHaveLength(1);
  expect(read('fraud/page.tsx')).toContain('status="Shadow Mode"');
  expect(read('source-blocks/page.tsx')).toContain('aktiv`}');
  expect(read('affiliates/page.tsx')).toContain('status="Read-only"');
 });
 it('gives every 403 dead end a way back to the account monitor',()=>{
  const hint=read('components/AccessDeniedHint.tsx');for(const marker of['href="/"','← Zurück zum Account Monitor','Fehlende Berechtigung: {permission}'])expect(hint).toContain(marker);
  const pages=['page.tsx','affiliates/page.tsx','automation/page.tsx','cohorts/page.tsx','fraud/page.tsx','source-blocks/page.tsx','admin/access/page.tsx','settings/security/page.tsx'];
  for(const route of pages){const blocks=read(route).match(/<main className="fatal">[\s\S]*?<\/main>/g)||[];for(const block of blocks.filter(block=>block.includes('403 ·'))){const ok=block.includes('<AccessDeniedHint')||block.includes('href="/"')||(route==='page.tsx'&&block.includes('Fehlende Berechtigung: dashboard.view'));expect(ok,`${route}: ${block.slice(0,80)}`).toBe(true)}}
  expect(read('cohorts/page.tsx')).toContain('permission="finance.view"');expect(read('automation/page.tsx')).toContain('permission="finance.view"');
 });
 it('standardizes header, filter surfaces, period controls and responsive density',()=>{
  const css=read('globals.css');
  for(const marker of['.dashboardPageHeader{','.dashboardPageTitle{','.dashboardPageStatus{','.dashboardPageDescription{','.affiliatePickerBar{','.affiliatePeriod{','.periods{','.customPeriod{','.cohortFilters{'])expect(css).toContain(marker);
  expect(css).toContain('@media(max-width:760px){.dashboardPageHeader{');
  expect(css).toContain('@media(max-width:560px){.dashboardPageTitle{');
 });
});
