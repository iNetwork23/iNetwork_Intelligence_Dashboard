// @vitest-environment jsdom
import React,{act,Suspense,use} from 'react';
import {hydrateRoot,type Root} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import LanguageProvider,{useLanguage} from '../app/components/LanguageProvider';
import SecurityPage from '../app/settings/security/page';
const session=vi.hoisted(()=>({user:{id:'legacy-admin',impersonating:false}}));
vi.mock('./session',()=>({currentUser:async()=>session.user}));
vi.mock('next/navigation',()=>({redirect:vi.fn(),usePathname:()=>'/settings/security',useSearchParams:()=>new URLSearchParams('period=7d')}));
vi.mock('next/link',()=>({default:({prefetch,...props}:React.ComponentProps<'a'>&{prefetch?:boolean})=>{void prefetch;return <a {...props}/>}}));
let root:Root|undefined;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('React',React);vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});document.body.replaceChildren();document.documentElement.dataset.locale='en'});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;vi.unstubAllGlobals()});
it.each([{id:'legacy-admin',impersonating:false},{id:'qa-account',impersonating:true}])('hydrates the real restricted security page for $id before localizing it',async(user)=>{
 session.user=user;const page=await SecurityPage();
 let delayed=false,resolve!:()=>void;const ready=new Promise<void>(done=>{resolve=done});
 function Deferred(){if(delayed)use(ready);return page}
 function Switch(){const{setLocale}=useLanguage();return <button id="de" onClick={()=>setLocale('de')}>DE</button>}
 const tree=<LanguageProvider><Switch/><Suspense fallback={<p>Bitte warten</p>}><Deferred/></Suspense></LanguageProvider>;
 const host=document.createElement('div');host.innerHTML=renderToString(tree);document.body.append(host);delayed=true;
 const recoverable=vi.fn();await act(async()=>{root=hydrateRoot(host,tree,{onRecoverableError:recoverable})});await act(async()=>resolve());
 expect(recoverable.mock.calls.map(args=>String(args[0]))).toEqual([]);
 expect(host.querySelector('h1')?.textContent).toBe('403 · Security settings are unavailable for this session type');
 expect(host.querySelector('a')?.textContent).toBe('To the dashboard');expect(host.querySelector('a')?.getAttribute('href')).toBe('/');
 await act(async()=>host.querySelector<HTMLButtonElement>('#de')!.click());
 expect(host.querySelector('h1')?.textContent).toBe('403 · Sicherheitseinstellungen für diesen Sitzungstyp nicht verfügbar');
 expect(host.querySelector('a')?.textContent).toBe('Zum Dashboard');expect(recoverable).not.toHaveBeenCalled();
});
