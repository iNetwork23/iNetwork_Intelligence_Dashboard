import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), 'src');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const css = () => read('app/globals.css');

describe('calm semantic BI design system', () => {
  it('defines one neutral dark token system with one blue interaction accent', () => {
    const source = css();
    for (const token of [
      '--bg:#0b0d10',
      '--surface-1:#111419',
      '--surface-2:#171b21',
      '--surface-3:#1d2229',
      '--border:#29303a',
      '--text-primary:#f4f6f8',
      '--text-secondary:#a3abb7',
      '--text-muted:#727b88',
      '--accent:#5b8def',
      '--positive:#3fbf8f',
      '--warning:#d8a84e',
      '--negative:#e1646f',
    ]) expect(source).toContain(token);
  });

  it('removes the legacy purple, neon-green and decorative gradient palette', () => {
    const source = css();
    for (const legacy of ['#150f23', '#1f1633', '#251b3a', '#8b7bd0', '#c2ef4e', '#2c2050']) {
      expect(source.toLowerCase()).not.toContain(legacy);
    }
    expect(source).not.toMatch(/body\s*\{[^}]*radial-gradient/);
  });

  it('uses blue for selection and keeps economic colors semantic', () => {
    const source = css();
    for (const selector of [
      '\\.periods a\\.active',
      '\\.viewTabs a\\.active',
      '\\.trafficModeTabs>a\\.active',
      '\\.smartSearch button,\\.refreshBtn,\\.watchHead button',
      '\\.loginCard button',
      '\\.pickerInput button',
      '\\.favoriteToggle\\.active',
      '\\.barTrack i',
      '\\.kpi\\.hero',
    ]) expect(source).toMatch(new RegExp(`${selector}\\{[^}]*var\\(--accent\\)`));
    expect(source).toMatch(/\.up\{[^}]*var\(--positive\)/);
    expect(source).toMatch(/\.down\{[^}]*var\(--negative\)/);
    expect(source).not.toMatch(/\.topbar h1 span\{[^}]*var\(--positive\)/);
    expect(source).not.toMatch(/\.directScope b\{[^}]*var\(--positive\)/);
  });

  it('keeps operational labels legible and interactive controls touch-sized on mobile', () => {
    const source = css();
    expect(source).toMatch(/\.kpi>span\{[^}]*font-size:12px/);
    expect(source).toMatch(/\.sharedKpi>span[^}]*\{[^}]*font-size:12px/);
    expect(source).toMatch(/@media\(max-width:600px\)[\s\S]*?button[^}]*min-height:44px/);
    expect(source).toMatch(/@media\(max-width:1024px\)\{\.topbar\{[^}]*flex-direction:column/);
    expect(source).toMatch(/@media\(max-width:1024px\)[\s\S]*?\.topActions\{[^}]*overflow-x:auto/);
  });

  it('marks the current primary route consistently in every protected view', () => {
    const files = ['app/page.tsx', 'app/affiliates/page.tsx', 'app/smartlinks/page.tsx', 'app/automation/page.tsx'];
    for (const file of files) expect(read(file)).toContain('aria-current="page"');
  });

  it('puts the actionable direct-traffic block before supporting lead-latency evidence', () => {
    const source = read('app/affiliates/page.tsx');
    expect(source.indexOf('className="nextActions"')).toBeGreaterThan(-1);
    expect(source.indexOf('className="nextActions"')).toBeLessThan(source.indexOf('className="leadLatencyPanel"'));
  });

  it('preserves the KPI definition and direct/smartlink separation in source', () => {
    expect(read('lib/dashboard.ts')).toMatch(/firstSaleRate[^\n]*firstSales[^\n]*sois/);
    expect(read('app/affiliates/page.tsx')).toContain("mode:'direct'|'smartlinks'");
    expect(read('app/affiliates/page.tsx')).toContain('strikt getrennte Modi');
  });
});
