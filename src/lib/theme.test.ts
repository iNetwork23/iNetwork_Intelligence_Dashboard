import {describe,expect,it} from 'vitest';
import {persistTheme,resolveTheme,themeBootScript,THEME_STORAGE_KEY} from './theme';

describe('dashboard theme initialization',()=>{
 it('prefers a persisted user choice and otherwise follows the operating system',()=>{
  expect(resolveTheme('light',true)).toBe('light');
  expect(resolveTheme('dark',false)).toBe('dark');
  expect(resolveTheme(null,true)).toBe('dark');
  expect(resolveTheme(null,false)).toBe('light');
  expect(resolveTheme('invalid',false)).toBe('light');
 });

 it('persists a manual choice and applies it to the document root',()=>{
  const root={dataset:{} as Record<string,string>,style:{colorScheme:''}};
  const writes:Array<[string,string]>=[];
  persistTheme('dark',root,{setItem:(key:string,value:string)=>writes.push([key,value])});
  expect(root.dataset.theme).toBe('dark');
  expect(root.style.colorScheme).toBe('dark');
  expect(writes).toEqual([[THEME_STORAGE_KEY,'dark']]);
 });

 it('applies the persisted theme before first paint',()=>{
  const root={dataset:{} as Record<string,string>,style:{colorScheme:''}};
  const window={localStorage:{getItem:(key:string)=>key===THEME_STORAGE_KEY?'light':null},matchMedia:()=>({matches:true})};
  new Function('window','document',themeBootScript())(window,{documentElement:root});
  expect(root.dataset.theme).toBe('light');
  expect(root.style.colorScheme).toBe('light');
 });
});
