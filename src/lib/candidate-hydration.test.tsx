// @vitest-environment jsdom
import React,{act,Suspense,use} from 'react';
import {hydrateRoot} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
import CandidateTopN from '../app/affiliates/CandidateTopN';
import LanguageProvider,{useLanguage} from '../app/components/LanguageProvider';
it('hydrates a delayed candidate list in English and preserves rows through expand, locale change and collapse',async()=>{
 vi.stubGlobal('React',React);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});document.documentElement.dataset.locale='en';
 let delayed=false,resolve!:()=>void;const ready=new Promise<void>(done=>{resolve=done});
 function Deferred(){if(delayed)use(ready);return <CandidateTopN as="ol" head={[<li key="one"><a href="/affiliates?affiliate=6">BEOBACHTEN</a></li>]} rest={[<li key="two" data-no-translate>Regel 1: partner name</li>]} restCount={1}/>}
 function Switch(){const{setLocale}=useLanguage();return <button id="de" onClick={()=>setLocale('de')}>DE</button>}
 const tree=<LanguageProvider><Switch/><Suspense fallback={<p>Bitte warten</p>}><Deferred/></Suspense></LanguageProvider>,host=document.createElement('div');host.innerHTML=renderToString(tree);document.body.replaceChildren(host);delayed=true;
 const recoverable=vi.fn(),root=hydrateRoot(host,tree,{onRecoverableError:recoverable});
 try{
  await act(async()=>resolve());expect(recoverable).not.toHaveBeenCalled();expect(host.querySelector('li a')?.textContent).toBe('WATCH');
  const toggle=host.querySelector<HTMLButtonElement>('.topNToggle')!;expect(toggle.textContent).toBe('Show more · 1 more');
  await act(async()=>toggle.click());expect(host.querySelectorAll('li')).toHaveLength(2);expect(host.querySelector('li[data-no-translate]')?.textContent).toBe('Regel 1: partner name');
  await act(async()=>host.querySelector<HTMLButtonElement>('#de')!.click());expect(host.querySelector('li a')?.textContent).toBe('BEOBACHTEN');expect(host.querySelector('a')?.getAttribute('href')).toBe('/affiliates?affiliate=6');
  await act(async()=>toggle.click());expect(host.querySelectorAll('li')).toHaveLength(1);expect(toggle.textContent).toBe('Mehr anzeigen · 1 weitere');expect(recoverable).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());vi.unstubAllGlobals();delete document.documentElement.dataset.locale}
});
