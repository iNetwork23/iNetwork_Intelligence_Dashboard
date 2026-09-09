// @vitest-environment jsdom
import React,{act,Suspense,use} from 'react';
import {hydrateRoot,type Root} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import LanguageProvider from '../app/components/LanguageProvider';
import SourceCandidateList from '../app/sources/SourceCandidateList';
import {DEFAULT_SOURCE_CANDIDATE_FILTERS,prepareSourceCandidateRows} from './source-candidate-view';
import type {SourceCandidate} from './source-candidates';
vi.mock('next/navigation',()=>({usePathname:()=>'/sources',useSearchParams:()=>new URLSearchParams('period=30d'),useRouter:()=>({push:vi.fn()})}));
vi.mock('next/link',()=>({default:({prefetch,...props}:React.ComponentProps<'a'>&{prefetch?:boolean})=>{void prefetch;return <a {...props}/>}}));
let root:Root|undefined;
beforeEach(()=>{
 vi.stubGlobal('React',React);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});document.body.replaceChildren();document.documentElement.dataset.locale='en';
 vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>setTimeout(()=>cb(0),0));vi.stubGlobal('cancelAnimationFrame',clearTimeout);vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({blocks:[]})}));
});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;vi.unstubAllGlobals()});
it('hydrates the delayed source list and preserves identities through localized selection and the bulk preview',async()=>{
 const candidate:SourceCandidate={affiliateId:'6',affiliate:'Standard',offerId:'2',offer:'App installieren',offerUrlId:'7',offerUrl:'Deutsch',trafficMode:'tracked',level:'main_source',mainValue:'App installieren',subValue:null,action:'AUSSCHALTEN',severity:'critical',reason:'50 SOIs ohne Sale',clicks:900,sois:60,firstSales:0,rebills:0,revenue:10,payout:120,profit:-110,lastLeadDate:'2026-09-03',leadStatus:'Heute aktiv'};
 const rows=prepareSourceCandidateRows([candidate],new Map(),{finance:true});
 let delayed=false,resolve!:()=>void;const ready=new Promise<void>(done=>{resolve=done});
 function Deferred(){if(delayed)use(ready);return <SourceCandidateList rows={rows} range="30d" openKey={null} initialFilters={DEFAULT_SOURCE_CANDIDATE_FILTERS} initialSort="profit" mayBlock finance/>}
 const tree=<LanguageProvider><Suspense fallback={<p>Bitte warten</p>}><Deferred/></Suspense></LanguageProvider>;
 const host=document.createElement('div');host.innerHTML=renderToString(tree);document.body.append(host);delayed=true;
 const recoverable=vi.fn();await act(async()=>{root=hydrateRoot(host,tree,{onRecoverableError:recoverable})});await act(async()=>resolve());
 expect(recoverable.mock.calls.map(x=>String(x[0]))).toEqual([]);
 expect(host.querySelector('.sourcesCount')?.textContent).toBe('1 candidates');
 expect(host.querySelector('td[data-label="Partner"] b')?.textContent).toBe('Standard');
 expect(host.querySelector('td[data-label="Offer"] b')?.textContent).toBe('App installieren · #2');
 expect(host.querySelector('td[data-label="Offer"] small')?.textContent).toBe('Deutsch · URL #7');
 expect(host.querySelector('td[data-label="Source"] b')?.textContent).toBe('App installieren');
 const checkbox=host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
 expect(checkbox.getAttribute('aria-label')).toBe('Select Standard · App installieren · App installieren');
 await act(async()=>checkbox.click());await act(async()=>{const button=host.querySelector<HTMLButtonElement>('.sourcesBulkButton')!;button.focus();button.click()});
 const modal=document.querySelector<HTMLElement>('[role="dialog"]')!;
 expect(modal.querySelector('#source-bulk-title')?.textContent).toBe('Block 1 source');
 expect(modal.querySelector('.sourceBulkRows b')?.textContent).toBe('Standard · App installieren (#2)');
 expect(modal.querySelector('.sourceBulkRows')?.textContent).toContain('App installieren');
 expect(modal.querySelector('.sourceConfirmBlock')?.textContent).toBe('Block 1 source now');expect(modal.querySelector<HTMLButtonElement>('.sourceConfirmBlock')?.disabled).toBe(true);
 const close=modal.querySelector<HTMLButtonElement>('.sourceBlockClose')!,cancel=modal.querySelector<HTMLButtonElement>('.sourceBlockCancel')!;
 expect(document.activeElement).toBe(close);
 await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true})));expect(document.activeElement).toBe(cancel);
 await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true})));expect(document.activeElement).toBe(close);
 await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(document.querySelector('[role="dialog"]')).toBeNull();
 expect(document.activeElement).toBe(host.querySelector('.sourcesBulkButton'));expect(vi.mocked(fetch).mock.calls.every(([,options])=>options?.method===undefined)).toBe(true);
});
