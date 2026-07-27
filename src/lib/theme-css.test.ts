import{readFileSync}from'node:fs';
import{join}from'node:path';
import{describe,expect,it}from'vitest';

const css=()=>readFileSync(join(process.cwd(),'src/app/globals.css'),'utf8');

describe('user-selectable dashboard themes',()=>{
 it('defines complete semantic dark and light palettes',()=>{
  const source=css();
  expect(source).toContain('--color-scheme:dark');
  expect(source).toContain('--on-accent:#07131a');
  expect(source).toContain('--line-strong:rgba(255,255,255,.08)');
  expect(source).toContain('html[data-theme="light"]{--color-scheme:light');
  for(const token of ['--bg:#f1f4f8','--surface-1:#ffffff','--surface-2:#f7f9fc','--surface-3:#e9eef5','--border:#cbd4e1','--text-primary:#172033','--text-secondary:#46556b','--text-muted:#536379','--accent:#245fbf','--positive:#147052','--warning:#8a5700','--negative:#b4233c','--on-accent:#ffffff'])expect(source).toContain(token);
 });

 it('themes native controls, overlays and Smartlink accents without dark-only literals',()=>{
  const source=css();
  expect(source).toContain('color-scheme:var(--color-scheme)');
  expect(source).toContain('background:var(--route-overlay)');
  expect(source).toContain('color:var(--on-accent)');
  expect(source).toContain('html[data-theme="light"] .sharedRotation,html[data-theme="light"] .campaignBody');
  expect(source).not.toMatch(/(?<!-)color-scheme:dark/);
  expect(source).not.toContain('border:1px solid rgba(255,255,255,.08)');
 });

 it('styles a persistent icon selector with theme-aware sun and moon states',()=>{
  const source=css();
  expect(source).toContain('.themeHeaderToggle{');
  expect(source).toContain('.themeHeaderToggle button{');
  expect(source).not.toContain('.themeSwitcher{position:fixed');
  expect(source).toContain('.themeIconSun');
  expect(source).toContain('html[data-theme="light"] .themeIconSun');
  expect(source).toContain('html[data-theme="light"] .themeIconMoon');
  expect(source).not.toContain('.themeSwitcher button[aria-pressed=true]');
  expect(source).not.toContain('@media(max-width:600px){.themeSwitcher');
  expect(source).toContain('width:44px;height:44px');
  expect(source).not.toContain('body{padding-bottom:calc(74px + env(safe-area-inset-bottom))');
 });
});
