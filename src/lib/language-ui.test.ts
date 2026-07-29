import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const read=(path:string)=>readFileSync(new URL(`../app/${path}`,import.meta.url),'utf8');

describe('global language control',()=>{
 it('mounts one global translator and pre-hydration language bootstrap',()=>{
  const layout=read('layout.tsx');
  expect(layout).toContain('localeBootScript');
  expect(layout).toContain('<LanguageProvider>');
 });
 it('offers the DE/EN control on both authenticated and login surfaces',()=>{
  expect(read('components/AdminSidebar.tsx')).toContain('<LanguageToggle');
  expect(read('login/page.tsx')).toContain('<LanguageToggle');
  const toggle=read('components/LanguageToggle.tsx');
  expect(toggle).toContain('DE');
  expect(toggle).toContain('EN');
  expect(toggle).toContain('aria-pressed');
 });
 it('keeps the login route free of the authenticated sidebar in either language',()=>{
  const frame=read('components/DashboardShellFrame.tsx');
  expect(frame).toContain('pathname==="/login"');
 });
});
