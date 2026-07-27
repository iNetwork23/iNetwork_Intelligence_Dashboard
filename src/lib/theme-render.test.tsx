import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import ThemeToggle from '../app/components/ThemeToggle';

describe('ThemeToggle',()=>{
 it('renders one accessible icon button for the available target theme',()=>{
  const html=renderToStaticMarkup(<ThemeToggle/>);
  expect(html).toContain('aria-label="Farbschema wechseln"');
  expect(html).toContain('data-theme-toggle="icon"');
  expect(html).toContain('themeIconSun');
  expect(html).toContain('themeIconMoon');
  expect(html.match(/<button/g)).toHaveLength(1);
  expect(html).not.toContain('>Hell</button>');
  expect(html).not.toContain('>Dunkel</button>');
 });

 it('initializes before paint and mounts the icon inside every dashboard header',()=>{
  const layout=readFileSync(join(process.cwd(),'src/app/layout.tsx'),'utf8');
  expect(layout).toContain('suppressHydrationWarning');
  expect(layout).toContain('themeBootScript()');
  expect(layout).toContain('dangerouslySetInnerHTML');
  expect(layout).not.toContain('<ThemeToggle/>');
  for(const route of['page.tsx','affiliates/page.tsx','automation/page.tsx','smartlinks/page.tsx','cohorts/page.tsx']){
   const source=readFileSync(join(process.cwd(),'src/app',route),'utf8');
   expect(source).toContain('<ThemeToggle/>');
   expect(source.indexOf('<ThemeToggle/>')).toBeGreaterThan(source.indexOf('className="topActions"'));
  }
 });
});
