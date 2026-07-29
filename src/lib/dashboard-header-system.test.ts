import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';
const read=(path:string)=>readFileSync(join(process.cwd(),'src/app',path),'utf8');

const routes=['page.tsx','affiliates/page.tsx','smartlinks/page.tsx','automation/page.tsx','cohorts/page.tsx','admin/access/page.tsx','settings/security/page.tsx'];

describe('shared professional dashboard header system',()=>{
 it('uses one reusable header across every protected dashboard page',()=>{
  for(const route of routes){const source=read(route);expect(source).toContain('<DashboardPageHeader');expect(source).not.toContain('className="topbar"')}
 });
 it('defines a compact hierarchy with semantic status and page-specific iconography',()=>{
  const source=read('components/DashboardPageHeader.tsx');
  for(const marker of['dashboardPageHeader','dashboardPageIcon','dashboardPageKicker','dashboardPageTitle','dashboardPageStatus','dashboardPageDescription'])expect(source).toContain(marker);
  for(const icon of['monitor','affiliate','smartlink','automation','cohorts','access','security'])expect(source).toContain(`"${icon}"`);
 });
 it('standardizes header, filter surfaces, period controls and responsive density',()=>{
  const css=read('globals.css');
  for(const marker of['.dashboardPageHeader{','.dashboardPageTitle{','.dashboardPageStatus{','.dashboardPageDescription{','.affiliatePickerBar{','.affiliatePeriod{','.periods{','.customPeriod{','.cohortFilters{'])expect(css).toContain(marker);
  expect(css).toContain('@media(max-width:760px){.dashboardPageHeader{');
  expect(css).toContain('@media(max-width:560px){.dashboardPageTitle{');
 });
});
