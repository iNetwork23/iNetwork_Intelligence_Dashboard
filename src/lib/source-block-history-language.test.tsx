// @vitest-environment jsdom
import React,{act,Suspense,use} from 'react';
import {createRoot,hydrateRoot,type Root} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import LanguageProvider,{useLanguage} from '../app/components/LanguageProvider';
import SourceBlockHistoryPanel from '../app/source-blocks/SourceBlockHistoryPanel';
import {localizeDisplayText,translateText} from './i18n';
let root:Root|undefined;
beforeEach(()=>{vi.stubGlobal('React',React);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});document.body.replaceChildren();document.documentElement.dataset.locale='en';vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({events:[{id:'event',at:'2026-09-04T20:27:00Z',action:'reconcile_ok',actorId:'Standard',reason:'App installieren',reasonCategory:'test'}]})}))});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;vi.unstubAllGlobals()});
function Switch(){const{setLocale}=useLanguage();return <button id="de" onClick={()=>setLocale('de')}>DE</button>}
it('keeps stored actor and reason verbatim while translating the read-only audit controls',async()=>{
 const host=document.createElement('div');document.body.append(host);root=createRoot(host);
 await act(async()=>root!.render(<LanguageProvider><Switch/><SourceBlockHistoryPanel blockId="fixture/id"/></LanguageProvider>));
 await act(async()=>host.querySelector<HTMLButtonElement>('.sourceBlockHistoryToggle')!.click());
 expect(host.querySelector('li small')?.textContent).toBe('App installieren');
 expect(host.querySelector('li')?.textContent).toContain('Standard');
 expect(host.querySelector('.sourceBlockHistoryToggle')?.textContent).toBe('Hide history');
 expect(host.querySelector('li b')?.textContent).toBe('Reconcile confirmed');
 expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/source-blocks?action=history&id=fixture%2Fid',{cache:'no-store'});
 await act(async()=>host.querySelector<HTMLButtonElement>('#de')!.click());expect(host.querySelector('li small')?.textContent).toBe('App installieren');expect(host.querySelector('.sourceBlockHistoryToggle')?.textContent).toBe('Historie ausblenden');
});
it('hydrates a delayed history control before translating the persisted language',async()=>{
 let delayed=false,resolve!:()=>void;const ready=new Promise<void>(done=>{resolve=done});
 function Deferred(){if(delayed)use(ready);return <SourceBlockHistoryPanel blockId="fixture"/>}
 const tree=<LanguageProvider><Suspense fallback={<p>Bitte warten</p>}><Deferred/></Suspense></LanguageProvider>;
 const host=document.createElement('div');host.innerHTML=renderToString(tree);document.body.append(host);delayed=true;
 const recoverable=vi.fn();await act(async()=>{root=hydrateRoot(host,tree,{onRecoverableError:recoverable})});await act(async()=>resolve());
 expect(recoverable.mock.calls.map(x=>String(x[0]))).toEqual([]);expect(host.querySelector('button')?.textContent).toBe('Show history');expect(fetch).not.toHaveBeenCalled();
});
it.each([
 ['Letzter Everflow-Abgleich:','Last Everflow reconcile:'],['Inaktiv','Inactive'],['Kategorie','Category'],
 ['Partner, Offer oder Quelle','Partner, offer or source'],['Gesperrt seit','Blocked since'],
 ['ohne Referenzwerte gesperrt (vor Einführung der Bilanz)','Blocked without reference values (before balances were introduced)'],
 ['Setting #464 · Payout 0 · Postback aus','Setting #464 · Payout 0 · Postback off'],
 ['1 aktiv','1 active'],
])('translates the block-register UI label %s',(de,en)=>expect(translateText(de,'en')).toBe(en));

it.each([
 ['Gesperrt seit 30.07.2026','Blocked since 30/07/2026'],
 [' · 1 ohne Bilanz (vor Etappe 4 gesperrt)',' · 1 without a balance (blocked before balances were recorded)'],
 ['vermieden 1.234,50 € · entgangen 987,65 € · 2 Sperren','avoided €1,234.50 · forgone €987.65 · 2 blocks'],
])('round trips the complete status message without changing values: %s',(de,en)=>{
 expect(localizeDisplayText(translateText(de,'en'),'en')).toBe(en);
 expect(localizeDisplayText(translateText(en,'de'),'de')).toBe(de);
});
it.each(['empty','failed'])('provides a localized %s history state without a business write',async(kind)=>{
 vi.mocked(fetch).mockResolvedValueOnce({ok:kind==='empty',json:async()=>({events:[]})} as Response);
 const host=document.createElement('div');document.body.append(host);root=createRoot(host);
 await act(async()=>root!.render(<LanguageProvider><SourceBlockHistoryPanel blockId="fixture"/></LanguageProvider>));
 await act(async()=>host.querySelector<HTMLButtonElement>('.sourceBlockHistoryToggle')!.click());
 expect(host.textContent).toContain(kind==='empty'?'No history available.':'History unavailable');
 if(kind==='failed'){
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  await act(async()=>host.querySelector<HTMLButtonElement>('.sourceBlockHistoryToggle')!.click());
  await act(async()=>host.querySelector<HTMLButtonElement>('.sourceBlockHistoryToggle')!.click());
  expect(host.querySelector('li small')?.textContent).toBe('App installieren');
  expect(host.querySelector('[role="alert"]')).toBeNull();
 }
 expect(vi.mocked(fetch).mock.calls.every(([,options])=>options?.method===undefined)).toBe(true);
});
