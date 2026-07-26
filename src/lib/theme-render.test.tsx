import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import ThemeToggle from '../app/components/ThemeToggle';

describe('ThemeToggle',()=>{
 it('renders explicit accessible light and dark choices',()=>{
  const html=renderToStaticMarkup(<ThemeToggle/>);
  expect(html).toContain('role="group"');
  expect(html).toContain('aria-label="Farbschema wählen"');
  expect(html).toContain('data-theme-option="light"');
  expect(html).toContain('data-theme-option="dark"');
  expect(html).toContain('>Hell</button>');
  expect(html).toContain('>Dunkel</button>');
  expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
 });

 it('is mounted globally and initializes before the body paints',()=>{
  const layout=readFileSync(join(process.cwd(),'src/app/layout.tsx'),'utf8');
  expect(layout).toContain('suppressHydrationWarning');
  expect(layout).toContain('themeBootScript()');
  expect(layout).toContain('dangerouslySetInnerHTML');
  expect(layout).toContain('<ThemeToggle/>');
 });
});
