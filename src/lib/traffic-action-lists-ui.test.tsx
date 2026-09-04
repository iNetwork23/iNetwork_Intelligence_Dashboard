import{readFileSync}from'node:fs';import{join}from'node:path';
import{describe,expect,it,vi}from'vitest';
import{renderToStaticMarkup}from'react-dom/server';
vi.mock('next/navigation',()=>({usePathname:()=>'/affiliates',useSearchParams:()=>new URLSearchParams(''),useRouter:()=>({push:vi.fn()})}));
import TrafficActionLists from'@/app/affiliates/TrafficActionLists';
import{CANDIDATE_TOP_N}from'@/app/affiliates/CandidateTopN';
import type{ConversionMetric,SourceBreakdownRow}from'@/lib/source-breakdown';
import{sourceRowBlockKeys,type SourceBlockMarkerIndex}from'@/lib/source-block-markers';

const metric=(x:Partial<ConversionMetric>):ConversionMetric=>({clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,payout:0,revenue:0,profit:0,profitPerSoi:0,...x});
const activity={lastLeadDate:'2026-08-22',asOf:'2026-08-23',coverageComplete:true,lookbackDays:365};
const stopRow=(sourceId:string,subSource:string,profit=-50):SourceBreakdownRow=>({pathKey:'20|154|0|1',offerId:'20',affiliateId:'154',offerUrlId:'1',sourceId,subSource,trafficMode:'tracked',mainValue:sourceId,subValue:subSource,today:metric({}),days7:metric({}),days30:metric({clicks:300,sois:0,profit}),activity});
const marker=(key:string,status:'active'|'error'):SourceBlockMarkerIndex=>({[key]:{id:`b-${key}`,status,effectiveAt:'2026-09-03T08:15:00.000Z',affiliateId:'154',offerId:'20'}});
const subKey=(sourceId:string,subSource:string)=>sourceRowBlockKeys({affiliateId:'154',offerId:'20',trafficMode:'tracked',mainValue:sourceId,subValue:subSource})[0];
const render=(rows:SourceBreakdownRow[],blocks?:SourceBlockMarkerIndex,canManage=false)=>renderToStaticMarkup(<TrafficActionLists rows={rows} urls={{'1':'lp.example'}} sourcePeriodLabel="30 Tage" blocks={blocks} canManage={canManage}/>);

describe('Tracker-Liste mit Sperrstatus',()=>{
 it('nimmt aktiv gesperrte Einheiten aus den Kandidaten und zählt sie separat mit Link für Sperrberechtigte',()=>{
  const rows=[stopRow('Source A','sub-1'),stopRow('Source A','sub-2')];
  const html=render(rows,marker(subKey('Source A','sub-1'),'active'),true);
  expect(html).not.toContain('Sub-Source: sub-1');
  expect(html).toContain('Sub-Source: sub-2');
  expect(html).toContain('1 gesperrte Quelle ausgeblendet');
  expect(html).toContain('href="/source-blocks"');
  expect(html).toContain('<b class="critical">1</b> AUSSCHALTEN');
  const readOnly=render(rows,marker(subKey('Source A','sub-1'),'active'));
  expect(readOnly).toContain('1 gesperrte Quelle ausgeblendet');
  expect(readOnly).not.toContain('href="/source-blocks"');
 });
 it('zeigt unklare Sperren als Marker in der Liste statt sie auszublenden',()=>{
  const html=render([stopRow('Source A','sub-1')],marker(subKey('Source A','sub-1'),'error'));
  expect(html).toContain('Sub-Source: sub-1');
  expect(html).toContain('Zustand unklar');
  expect(html).not.toContain('ausgeblendet');
 });
 it('zeigt ohne Sperr-Index alle Kandidaten unverändert',()=>{
  const html=render([stopRow('Source A','sub-1')]);
  expect(html).toContain('Sub-Source: sub-1');expect(html).not.toContain('ausgeblendet');expect(html).not.toContain('Gesperrt seit');
 });
 it('begrenzt jede Liste auf Top-10 mit Client-Toggle für den Rest',()=>{
  const rows=Array.from({length:14},(_,i)=>stopRow('Source A',`sub-${String(i).padStart(2,'0')}`,-1-i));
  const html=render(rows);
  expect(CANDIDATE_TOP_N).toBe(10);
  expect(html).toContain('Sub-Source: sub-13');
  expect(html).toContain('Sub-Source: sub-04');
  expect(html).not.toContain('Sub-Source: sub-03');
  expect(html).toContain('Mehr anzeigen · 4 weitere');
  expect(html).toContain('<b class="critical">14</b> AUSSCHALTEN');
  expect(render(rows.slice(0,10))).not.toContain('Mehr anzeigen');
 });
});

describe('Klickflächen für mobile Kontrolle (D20)',()=>{
 it('gibt Toggle, Marker und Ausgeblendet-Link mindestens 44 px Höhe',()=>{
  const css=readFileSync(join(process.cwd(),'src/app/globals.css'),'utf8');
  expect(css).toMatch(/\.topNToggle\{[^}]*min-height:44px/);
  expect(css).toMatch(/\.blockMarker\{[^}]*min-height:44px/);
  expect(css).toMatch(/\.blockedHidden a\{[^}]*min-height:44px/);
  expect(css).toMatch(/\.cockpitList li a\{[^}]*min-height:44px/);
  expect(css).toMatch(/\.priorityList li a\{[^}]*min-height:44px/);
  expect(css).toMatch(/\.priorityList\{[^}]*overflow-x:hidden/);
 });
});
