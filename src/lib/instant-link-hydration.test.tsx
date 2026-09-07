// @vitest-environment jsdom
import React,{act,Suspense,use} from 'react';
import {hydrateRoot,type Root} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import LanguageProvider,{useLanguage} from '../app/components/LanguageProvider';
import InstantLink from '../app/affiliates/InstantLink';

vi.mock('next/navigation',()=>({usePathname:()=>'/cohorts',useSearchParams:()=>new URLSearchParams('affiliate=154')}));
vi.mock('next/link',()=>({default:({prefetch,...props}:React.ComponentProps<'a'>&{prefetch?:boolean})=>{void prefetch;return <a {...props}/>}}));
let root:Root|undefined;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('React',React);vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});document.body.replaceChildren();document.documentElement.dataset.locale='en'});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;vi.unstubAllGlobals()});

it('hydrates a delayed cohort reset link before applying the persisted English language',async()=>{
 let delayed=false,resolve!:()=>void;
 const ready=new Promise<void>(done=>{resolve=done});
 function DeferredReset(){if(delayed)use(ready);return <InstantLink href="/cohorts" title="Zurücksetzen">Zurücksetzen</InstantLink>}
 const tree=<LanguageProvider><Suspense fallback={<p>Bitte warten</p>}><DeferredReset/></Suspense></LanguageProvider>;
 const host=document.createElement('div');host.innerHTML=renderToString(tree);document.body.append(host);delayed=true;
 const recoverable=vi.fn();await act(async()=>{root=hydrateRoot(host,tree,{onRecoverableError:recoverable})});
 await act(async()=>resolve());
 expect(recoverable.mock.calls.map(args=>String(args[0]))).toEqual([]);
 expect(host.querySelector('a')?.textContent).toBe('Reset');
 expect(host.querySelector('a')?.title).toBe('Reset');
 expect(host.querySelector('a')?.getAttribute('href')).toBe('/cohorts');
});

it('localizes nested link text through React and returns to German without changing business identifiers',async()=>{
 function Switch(){const{setLocale}=useLanguage();return <button id="de" onClick={()=>setLocale('de')}>DE</button>}
 const tree=<LanguageProvider><Switch/><InstantLink href="/cohorts"><><span>Zurücksetzen</span><strong>1.234,50 €</strong><code>Source 1234</code></></InstantLink></LanguageProvider>;
 const host=document.createElement('div');host.innerHTML=renderToString(tree);document.body.append(host);const recoverable=vi.fn();
 await act(async()=>{root=hydrateRoot(host,tree,{onRecoverableError:recoverable})});
 expect(host.querySelector('a span')?.textContent).toBe('Reset');
 expect(host.querySelector('strong')?.textContent).toBe('€1,234.50');
 await act(async()=>{(host.querySelector('#de') as HTMLButtonElement).click()});
 expect(host.querySelector('a span')?.textContent).toBe('Zurücksetzen');
 expect(host.querySelector('strong')?.textContent).toBe('1.234,50 €');
 expect(host.querySelector('code')?.textContent).toBe('Source 1234');
 expect(recoverable).not.toHaveBeenCalled();
});
