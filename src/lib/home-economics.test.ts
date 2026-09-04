import{readFileSync}from'node:fs';
import{join}from'node:path';
import{describe,expect,it}from'vitest';
import{buildConcentration,euro,perSoiText,profitMedianDelta}from'./home-kpis';
import{CONCENTRATION_WARN_SHARE}from'./economics';
import{maturityGateText}from'./verdict-vocabulary';
import{translations}from'./i18n-translations';
import type{EntityRow,Metrics}from'./portfolio';
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const metrics=(x:Partial<Metrics>={}):Metrics=>({clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,payout:0,revenue:0,profit:0,profitEpc:0,...x});
const entity=(id:string,name:string,x:Partial<Metrics>={}):EntityRow=>({...metrics(x),id,name,pathCount:1});

describe('home economics (Abnahme F: CPL, Umsatz je SOI, Top-1-Anteil, Median-Vergleich)',()=>{
 it('formats per-SOI money and explains the dash without SOIs',()=>{
  expect(perSoiText(150,30)).toEqual({text:euro(5),reason:null});expect(perSoiText(-60,30).text).toBe(euro(-2));expect(euro(5)).toMatch(/^5,00\s€$/);expect(perSoiText(150,0)).toEqual({text:'–',reason:'keine SOIs'});
 });
 it('compares each profit against the median of the visible rows through formatDelta/signTone with the maturity gate',()=>{
  const rows=[entity('1','A',{clicks:1000,sois:50,profit:130}),entity('2','B',{clicks:900,sois:40,profit:100}),entity('3','C',{clicks:20,sois:2,profit:-10}),entity('4','D',{clicks:800,sois:30,profit:70})];
  const median=85;
  const a=profitMedianDelta(rows[0],median);expect(a.delta.text).toBe('+45,00 € (+53 %)');expect(a.delta.direction).toBe('up');expect(a.tone).toBe('positive');expect(a.delta.reason).toBeNull();
  const d=profitMedianDelta(rows[3],median);expect(d.delta.text).toBe('-15,00 € (-18 %)');expect(d.tone).toBe('negative');
  const c=profitMedianDelta(rows[2],median);expect(c.delta.text).toBe('–');expect(c.delta.reason).toBe(maturityGateText);expect(c.tone).toBe('neutral');
  const none=profitMedianDelta(rows[0],null);expect(none.delta.text).toBe('–');expect(none.delta.reason).toBe('kein Median');expect(none.tone).toBe('neutral');
  const zero=profitMedianDelta({...rows[0],profit:85},median);expect(zero.delta.direction).toBe('flat');expect(zero.tone).toBe('neutral');
 });
 it('builds the concentration tile with top-1 SOI share, profit share only with finance and a warning from 40 % on',()=>{
  const affiliates=[entity('1','Alpha',{sois:45,profit:10}),entity('2','Beta',{sois:30,profit:80}),entity('3','Gamma',{sois:25,profit:-20})];
  const tile=buildConcentration({affiliates,finance:true,periodQuery:'period=30d'});
  expect(tile.href).toBe('/?period=30d&view=affiliates');expect(tile.label).toBe('Konzentration');
  expect(tile.shares.map(s=>s.label)).toEqual(['Anteil an SOIs','Anteil am Profit']);
  expect(tile.shares[0]).toMatchObject({share:0.45,name:'Alpha',text:'45 % · Alpha',warn:true});
  expect(tile.shares[1]).toMatchObject({share:80/90,name:'Beta',text:'89 % · Beta',warn:true});
  expect(tile.thresholdText).toBe(`Warnschwelle ${CONCENTRATION_WARN_SHARE*100} % Top-1-Anteil`);expect(tile.warn).toBe(true);expect(tile.warnText).toBe(`Klumpenrisiko · Top-1-Partner ab ${CONCENTRATION_WARN_SHARE*100} % Anteil`);
  expect(tile.sub).toBe('Top 3: 100 % der SOIs · 3 Partner mit SOIs');
  const broad=buildConcentration({affiliates:[entity('1','A',{sois:30}),entity('2','B',{sois:30}),entity('3','C',{sois:39}),entity('4','D',{sois:1})],finance:false,periodQuery:'period=7d'});
  expect(broad.shares).toHaveLength(1);expect(broad.shares[0].warn).toBe(false);expect(broad.warn).toBe(false);expect(broad.warnText).toBeNull();expect(broad.shares[0].text).toBe('39 % · C');expect(broad.sub).toBe('Top 3: 99 % der SOIs · 4 Partner mit SOIs');
  for(const share of broad.shares){expect(share.text).not.toContain('€')}
  const empty=buildConcentration({affiliates:[],finance:true,periodQuery:'period=30d'});
  expect(empty.shares[0]).toMatchObject({share:null,name:null,text:'–',warn:false});expect(empty.shares[1].text).toBe('–');expect(empty.warn).toBe(false);expect(empty.sub).toBe('Keine SOIs im Zeitraum');
 });
 it('mounts per-SOI columns, the median delta and the concentration tile on the home page without a private traffic light',()=>{
  const page=read('src/app/page.tsx');
  expect(page).toContain("from '@/lib/economics'");
  for(const marker of['buildConcentration','perSoiText','profitMedianDelta'])expect(page).toContain(marker);
  const financeHead=page.slice(page.indexOf('{finance&&<><th>'),page.indexOf('</>}</tr></thead>'));
  for(const column of['<th>Payout je SOI</th>','<th>Umsatz je SOI</th>','<th>Profit je SOI</th>','<th>Profit-EPC</th>'])expect(financeHead).toContain(column);
  for(const column of['Payout je SOI','Umsatz je SOI','Profit je SOI','Profit-EPC'])expect(page.match(new RegExp(`<th>${column.replace('-','\\-')}</th>`,'g'))).toHaveLength(1);
  expect(page).toContain('medianOf(displayedRows.map(row=>row.profit))');
  expect(page).toContain('profitMedianDelta(row,profitMedian)');
  expect(page).toContain('className={`medianDelta ${toneClass(median.tone)}`.trim()} title={median.delta.reason??undefined}');
  expect(page).toContain('Δ Median {median.delta.text}');
  for(const cell of['data-label="Payout je SOI"','data-label="Umsatz je SOI"','data-label="Profit je SOI"'])expect(page).toContain(cell);
  expect(page).not.toMatch(/\?'up':'down'/);expect(page).not.toContain('>=0?');expect(page).not.toContain('>0?\'up\'');
  expect(page).toContain("concentration=user.access.role!=='partner'?buildConcentration(");
  expect(page).toContain('{concentration&&<InstantLink className={`concentration${concentration.warn?\' warn\':\'\'}`} href={concentration.href}');
  expect(page.indexOf('className={`concentration')).toBeGreaterThan(page.indexOf('<section className="kpis">'));
  expect(page).toContain('<div className="tableWrap"><table className="performanceTable">');
  expect(page).not.toContain('CONCENTRATION_WARN_SHARE');
 });
 it('styles the new cells and tile only with existing tokens and translates the new labels',()=>{
  const css=read('src/app/globals.css');
  for(const marker of['.medianDelta{','.medianDelta.up{color:var(--positive)}','.medianDelta.down{color:var(--negative)}','.concentration{','.concentration.warn','.concentrationWarn{'])expect(css).toContain(marker);
  const block=css.slice(css.indexOf('.concentration{'));expect(block).not.toMatch(/gradient|animation|box-shadow:[^;]*rgba\(/);
  for(const key of['Payout je SOI','Umsatz je SOI','Profit je SOI','Konzentration','Anteil an SOIs','Anteil am Profit','Δ Median','keine SOIs','kein Median','Keine SOIs im Zeitraum','Firmen / Affiliates nach Anteil'])expect(translations[key as keyof typeof translations],key).toBeDefined();
 });
});
