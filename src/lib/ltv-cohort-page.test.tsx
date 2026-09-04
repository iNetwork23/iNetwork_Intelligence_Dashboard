import{readFileSync}from'node:fs';import{join}from'node:path';
import{describe,expect,it,vi}from'vitest';
import{renderToStaticMarkup}from'react-dom/server';
let search='affiliate=154&period=7d&sourceOpen=x';
vi.mock('next/navigation',()=>({usePathname:()=>'/affiliates',useSearchParams:()=>new URLSearchParams(search),useRouter:()=>({push:vi.fn()})}));
import LtvBreakevenLink from'@/app/affiliates/LtvBreakevenLink';
import{ProfitPeriod}from'@/app/affiliates/AffiliatePanels';

const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const metrics={clicks:120,sois:30,cvr:25,firstSales:3,firstSaleRate:10,rebills:1,coinSpend:0,payout:36,revenue:50,profit:14,profitPerSoi:0.47};

describe('Link „LTV-Kurve und Break-even“ von der Partnerseite (≤ 2 Klicks)',()=>{
 it('führt mit Partner-ID aus der URL und globalem Zeitraum nach /cohorts, ohne fremde Parameter',()=>{
  const html=renderToStaticMarkup(<LtvBreakevenLink/>);
  expect(html).toContain('href="/cohorts?affiliate=154&amp;period=7d"');
  expect(html).toContain('LTV-Kurve und Break-even');
  expect(html).not.toContain('sourceOpen');
 });
 it('bevorzugt die übergebene Partner-ID und rendert ohne Partner nichts',()=>{
  expect(renderToStaticMarkup(<LtvBreakevenLink affiliateId="7"/>)).toContain('href="/cohorts?affiliate=7&amp;period=7d"');
  search='';
  expect(renderToStaticMarkup(<LtvBreakevenLink/>)).toBe('');
  expect(renderToStaticMarkup(<LtvBreakevenLink affiliateId="7"/>)).toContain('href="/cohorts?affiliate=7"');
  search='affiliate=154&period=7d';
 });
 it('hängt am Profit-Panel des Cockpits (bereits gerenderte Stelle) und bleibt dort ein einzelner Link',()=>{
  const html=renderToStaticMarkup(<ProfitPeriod label="30 Tage" m={metrics as never} affiliateId="9"/>);
  expect(html.match(/LTV-Kurve und Break-even/g)).toHaveLength(1);
  expect(html).toContain('href="/cohorts?affiliate=9&amp;period=7d"');
  const source=read('src/app/affiliates/AffiliatePanels.tsx');
  expect(source).toContain('LtvBreakevenLink');
 });
});

describe('/cohorts – Karte „LTV je Partner“',()=>{
 const source=read('src/app/cohorts/page.tsx');
 it('liest den Partner-Filter aus der URL und bietet die Partnerwahl als Select aus den Kohorten-Dimensionen',()=>{
  expect(source).toContain('<select name="affiliate"');
  expect(source).toContain('affiliate:filters.affiliate');
  expect(source).toMatch(/new Set\(allRows\.map\(row=>row\.affiliate_id\)\)/);
 });
 it('rechnet Kurve, CPL und Break-even über das Modul und zeichnet die Kurve mit dem gemeinsamen Sparkline-Baustein',()=>{
  for(const marker of['buildLtvCurve(','entityRates(','findBreakEven(','breakEvenSummary(','ltvSparklinePoints(','<Sparkline ','LTV je Partner','Payout je SOI','Umsatz je SOI','noch nicht reif'])expect(source).toContain(marker);
  expect(source).toMatch(/from '\.\.\/components\/Sparkline'/);
 });
 it('holt die CPL über den vorhandenen Portfolio-Loader mit Zugriffsobjekt für den Seitenzeitraum und zeigt die Zeitraumwahl',()=>{
  expect(source).toMatch(/getDashboard\(period,.*?user\.access\)/);
  expect(source).toContain('resolveGlobalPeriod(filters.period)');
  expect(source).toContain('<PeriodControls dimension="global"');
  expect(source).toContain('withPeriod(params)');
  expect(source).toContain('type="hidden" name={key}');
 });
 it('behält das Finanzrecht als Gate und zeigt Partnern nichts Neues (D7)',()=>{
  expect(source).toContain("can(user.access,'finance.view')");
  expect(source).toContain("user.access.role!=='partner'");
  expect(source.indexOf("can(user.access,'finance.view')")).toBeLessThan(source.indexOf('buildLtvCurve('));
 });
 it('Sidebar-Eintrag LTV-Kohorten bleibt',()=>{expect(read('src/app/components/AdminSidebar.tsx')).toContain('href:"/cohorts",label:"LTV-Kohorten"')});
});
