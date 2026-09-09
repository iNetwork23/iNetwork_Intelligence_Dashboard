// @vitest-environment jsdom
import React,{act,Suspense,use} from 'react';
import {hydrateRoot,type Root} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import LanguageProvider,{useLanguage} from '../app/components/LanguageProvider';
import SourceBlocksPage from '../app/source-blocks/page';
const fixture=vi.hoisted(()=>({id:'block-fixture',affiliateId:6,affiliateName:'Standard',offerId:2,offerName:'App installieren',trafficMode:'tracked',level:'sub_source',mainField:'source_id',mainValue:'Standard',subField:'sub1',subValue:'App installieren',status:'active',effectiveAt:'2026-08-01T12:00:00Z',updatedAt:'2026-08-01T12:00:00Z',updatedBy:'Standard',reason:'App installieren',everflowSettingId:'fixture'}));
vi.mock('server-only',()=>({}));
vi.mock('next/navigation',()=>({redirect:vi.fn()}));
vi.mock('./session',()=>({currentUser:async()=>({access:{role:'super_admin'}})}));
vi.mock('./rbac',()=>({can:()=>true}));
vi.mock('./access-store',()=>({securityStore:()=>({})}));
vi.mock('./source-block-service',()=>({listSourceBlocks:async()=>[fixture]}));
vi.mock('./block-effects',()=>({loadBlockEffects:async()=>[]}));
vi.mock('./source-block-reconcile',()=>({loadReconcileMarkers:async()=>new Map()}));
vi.mock('./data-status',()=>({getDataStatus:async()=>null}));
vi.mock('./supabase-reporting',()=>({reportingRange:()=>({from:'2026-08-11',to:'2026-09-09'})}));
let root:Root|undefined;
beforeEach(()=>{
 vi.stubGlobal('React',React);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});
 document.body.replaceChildren();document.documentElement.dataset.locale='en';
 vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>setTimeout(()=>cb(0),0));vi.stubGlobal('cancelAnimationFrame',clearTimeout);
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({blocks:[fixture]})}));
});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;vi.unstubAllGlobals()});
function Switch(){const{setLocale}=useLanguage();return <button id="de" onClick={()=>setLocale('de')}>DE</button>}
it('hydrates the streamed block register and its control before translating, and localizes the portal without changing its scope',async()=>{
 const page=await SourceBlocksPage({searchParams:Promise.resolve({})});
 let delayed=false,resolve!:()=>void;const ready=new Promise<void>(done=>{resolve=done});
 function Deferred(){if(delayed)use(ready);return page}
 const tree=<LanguageProvider><Switch/><Suspense fallback={<p>Bitte warten</p>}><Deferred/></Suspense></LanguageProvider>;
 const host=document.createElement('div');host.innerHTML=renderToString(tree);document.body.append(host);delayed=true;
 const recoverable=vi.fn();await act(async()=>{root=hydrateRoot(host,tree,{onRecoverableError:recoverable})});await act(async()=>resolve());
 expect(recoverable.mock.calls.map(x=>String(x[0]))).toEqual([]);
 expect(host.querySelector('.sourceBlockNotice')?.textContent).toContain('Traffic is not discarded.');
 expect(host.querySelector('option[value="inactive"]')?.textContent).toBe('Inactive');
 expect(host.querySelector('.sourceBlockIconButton span')?.textContent).toBe('Blocked since 01/08/2026');
 const trigger=host.querySelector<HTMLButtonElement>('.sourceBlockIconButton')!;
 await act(async()=>trigger.click());
 const modal=document.querySelector<HTMLElement>('[role="dialog"]')!;
 expect(modal.querySelector('#source-block-title')?.textContent).toBe('Sub1: Unblock');
 expect([...modal.querySelectorAll('.sourceBlockScope dd')].map(e=>e.textContent)).toEqual(['Standard','App installieren','Source: Standard · Sub1: App installieren']);
 expect(modal.querySelector('.sourceBlockCancel')?.textContent).toBe('Cancel');
 expect(modal.querySelector('.sourceBlockClose')?.getAttribute('aria-label')).toBe('Close dialog');
 vi.mocked(fetch).mockResolvedValueOnce({ok:true,json:async()=>({events:[{id:'event',at:'2026-08-01T12:00:00Z',action:'reconcile_ok',actorId:'Standard',error:'App installieren'}]})} as Response);
 await act(async()=>modal.querySelector<HTMLButtonElement>('.sourceBlockHistoryToggle')!.click());
 expect(modal.querySelector('.sourceBlockHistoryList b')?.textContent).toBe('Reconcile confirmed');
 expect(modal.querySelector('.sourceBlockHistoryList')?.textContent).toContain('Standard');
 expect(modal.querySelector('.sourceBlockHistoryList small')?.textContent).toBe('App installieren');
 expect(vi.mocked(fetch).mock.calls.every(([,options])=>options?.method===undefined)).toBe(true);
 await act(async()=>modal.querySelector<HTMLButtonElement>('.sourceBlockClose')!.click());expect(document.querySelector('[role="dialog"]')).toBeNull();
 await act(async()=>host.querySelector<HTMLButtonElement>('#de')!.click());
 expect(host.querySelector('.sourceBlockIconButton span')?.textContent).toBe('Gesperrt seit 01.08.2026');
 expect(host.querySelector('option[value="inactive"]')?.textContent).toBe('Inaktiv');
 expect(recoverable).not.toHaveBeenCalled();
});
