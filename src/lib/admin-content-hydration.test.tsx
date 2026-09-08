// @vitest-environment jsdom
import React,{act,Suspense,use} from 'react';
import {hydrateRoot,type Root} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import LanguageProvider,{useLanguage} from '../app/components/LanguageProvider';
import AccessConsole from '../app/admin/access/AccessConsole';
import AppInstallation from '../app/settings/app/AppInstallation';
import DealRegisterForm from '../app/settings/deals/DealRegisterForm';
import {DEFAULT_DEAL_RULES} from './deal-register';

let root:Root|undefined;
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('React',React);
 vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({users:[],roles:[],permissions:[],publicKey:'',devices:0,oneSignalConfigured:false})})));
 window.matchMedia=vi.fn(()=>({matches:false})) as unknown as typeof window.matchMedia;
 document.body.replaceChildren();document.documentElement.dataset.locale='en';
});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;vi.unstubAllGlobals()});

it.each([
 ['access',()=> <AccessConsole/>,'Overview','Übersicht'],
 ['deals',()=> <DealRegisterForm initialRevision="defaults:test" initialRules={[...DEFAULT_DEAL_RULES]} initialSource="defaults" defaults={DEFAULT_DEAL_RULES}/>,'Create rule','Regel anlegen'],
 ['app',()=> <AppInstallation/>,'OneSignal API','OneSignal API'],
] as const)('hydrates delayed %s content in English without replacing the server tree',async(_name,content,english,german)=>{
 let delayed=false,resolve!:()=>void;const ready=new Promise<void>(done=>{resolve=done});
 function Deferred(){if(delayed)use(ready);return content()}
 function Switch(){const{setLocale}=useLanguage();return <button id="de" onClick={()=>setLocale('de')}>DE</button>}
 const tree=<LanguageProvider><Switch/><Suspense fallback={<p>Bitte warten</p>}><Deferred/></Suspense></LanguageProvider>;
 const host=document.createElement('div');host.innerHTML=renderToString(tree);document.body.append(host);delayed=true;
 const recoverable=vi.fn();await act(async()=>{root=hydrateRoot(host,tree,{onRecoverableError:recoverable})});
 await act(async()=>resolve());
 expect(recoverable.mock.calls.map(args=>String(args[0]))).toEqual([]);
 expect(host.textContent).toContain(english);
 await act(async()=>host.querySelector<HTMLButtonElement>('#de')!.click());
 expect(host.textContent).toContain(german);
 expect(vi.mocked(fetch).mock.calls.every(([,options])=>!options?.method||options.method==='GET')).toBe(true);
});
