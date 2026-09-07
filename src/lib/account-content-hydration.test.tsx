// @vitest-environment jsdom
import React,{act,Suspense,use} from 'react';
import {hydrateRoot,type Root} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import LanguageProvider,{useLanguage} from '../app/components/LanguageProvider';
import DashboardPageHeader from '../app/components/DashboardPageHeader';
import LocalizedMain from '../app/components/LocalizedMain';

let root:Root|undefined;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('React',React);vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});document.body.replaceChildren();document.documentElement.dataset.locale='en'});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;vi.unstubAllGlobals()});

it('hydrates streamed account content before translating server-rendered headings and amounts',async()=>{
 let delayed=false,resolve!:()=>void;
 const ready=new Promise<void>(done=>{resolve=done});
 // RSC sends the rendered host tree, not the server-only header function, to the client boundary.
 const header=DashboardPageHeader({kicker:'ME Media · Everflow Monitor',title:'Gesamter Account',description:'Alle Offers, Affiliates, Smartlinks und Direkt-Traffic auf einen Blick.',status:'Synchronisierung läuft',tone:'neutral',icon:'monitor'});
 function Deferred(){if(delayed)use(ready);return <LocalizedMain className="dashboard">{header}<table><tbody><tr><td data-label="Profit"><b>56954,22 €</b></td></tr></tbody></table></LocalizedMain>}
 function Switch(){const{locale,setLocale}=useLanguage();return <button id="switch-locale" onClick={()=>setLocale(locale==='en'?'de':'en')}>Switch</button>}
 const tree=<LanguageProvider><Switch/><Suspense fallback={<p>Bitte warten</p>}><Deferred/></Suspense></LanguageProvider>;
 const host=document.createElement('div');host.innerHTML=renderToString(tree);document.body.append(host);delayed=true;
 const recoverable=vi.fn();await act(async()=>{root=hydrateRoot(host,tree,{onRecoverableError:recoverable})});
 await act(async()=>resolve());
 expect(recoverable.mock.calls.map(args=>String(args[0]))).toEqual([]);
 expect(host.querySelector('h1')?.textContent).toBe('Entire account');
 expect(host.querySelector('td b')?.textContent).toBe('€56954.22');
 await act(async()=>host.querySelector<HTMLButtonElement>('#switch-locale')!.click());
 expect(host.querySelector('h1')?.textContent).toBe('Gesamter Account');
 expect(host.querySelector('td b')?.textContent).toBe('56954,22 €');
});
