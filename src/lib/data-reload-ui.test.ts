import{readFileSync}from'node:fs';
import{join}from'node:path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>readFileSync(join(process.cwd(),file),'utf8');
describe('affiliate data reload control',()=>{
 it('is always visible in the affiliate toolbar and performs a full reload',()=>{
  const page=read('src/app/affiliates/page.tsx');
  const control=read('src/app/affiliates/DataReloadButton.tsx');
  expect(page).toContain("import DataReloadButton from'./DataReloadButton'");
  expect(page).toContain('<DataReloadButton/>');
  expect(control).toContain("'use client'");
  expect(control).toContain('globalThis.location.reload()');
  expect(control).toContain('Daten neu laden');
  expect(control).toContain('aria-label="Affiliate-Daten neu laden"');
 });
 it('keeps the reload control touch-friendly on mobile',()=>{
  const css=read('src/app/globals.css');
  expect(css).toContain('.dataReloadButton');
  expect(css).toContain('min-height:44px');
 });
});
