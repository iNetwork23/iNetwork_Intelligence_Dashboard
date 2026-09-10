// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
// Next exposes exports of a use-client module to server code as client references,
// not their runtime numeric values. Keep the real component for interaction tests.
vi.mock('../app/affiliates/CandidateTopN',async importOriginal=>({...await importOriginal<object>(),CANDIDATE_TOP_N:()=>null}));
vi.mock('next/navigation',()=>({usePathname:()=>'/affiliates',useSearchParams:()=>new URLSearchParams(''),useRouter:()=>({push:vi.fn()})}));
import TrafficActionLists from '../app/affiliates/TrafficActionLists';
import type {ConversionMetric,SourceBreakdownRow} from './source-breakdown';
const metric=(profit=0):ConversionMetric=>({clicks:300,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,payout:0,revenue:0,profit,profitPerSoi:0});
const rows:SourceBreakdownRow[]=Array.from({length:14},(_,i)=>({pathKey:'20|154|0|1',offerId:'20',affiliateId:'154',offerUrlId:'1',sourceId:'Source A',subSource:`sub-${i}`,trafficMode:'tracked',mainValue:'Source A',subValue:`sub-${i}`,today:metric(),days7:metric(),days30:metric(-i-1),activity:{lastLeadDate:'2026-08-22',asOf:'2026-08-23',coverageComplete:true,lookbackDays:365}}));
afterEach(()=>vi.unstubAllGlobals());
it('keeps the first ten server candidates visible and makes every remaining candidate reachable',async()=>{
 vi.stubGlobal('React',React);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 const host=document.createElement('div');document.body.replaceChildren(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<TrafficActionLists rows={rows} urls={{'1':'lp.example'}} sourcePeriodLabel="30 Tage"/>));
  expect(host.querySelectorAll('.priorityRow')).toHaveLength(10);
  const toggle=host.querySelector<HTMLButtonElement>('.topNToggle')!;expect(toggle.textContent).toBe('Mehr anzeigen · 4 weitere');
  await act(async()=>toggle.click());expect(host.querySelectorAll('.priorityRow')).toHaveLength(14);expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(new Set([...host.querySelectorAll('.priorityRow')].map(e=>e.getAttribute('data-key'))).size).toBe(14);
  await act(async()=>toggle.click());expect(host.querySelectorAll('.priorityRow')).toHaveLength(10);expect(toggle.getAttribute('aria-expanded')).toBe('false');
 }finally{await act(async()=>root.unmount())}
});
