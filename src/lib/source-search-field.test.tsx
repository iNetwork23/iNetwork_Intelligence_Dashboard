// @vitest-environment jsdom
import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import LanguageProvider,{useLanguage} from '../app/components/LanguageProvider';
import SourceSearchField from '../app/components/SourceSearchField';

it('keeps the search name stable, returns focus after reset, and preserves unrelated URL state',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);document.documentElement.dataset.locale='en';window.history.replaceState({},'','/affiliates?period=30d&sourceQuery_qa=l23610#campaign-2');
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 function Fields(){const[value,setValue]=useState(''),{setLocale}=useLanguage();return <><SourceSearchField value={value} onChange={setValue} placeholder="Source, Sub1, ADV1 oder ADV2 suchen" scopeId="qa"/><button id="de" onClick={()=>setLocale('de')}>DE</button></>}
 try{
  await act(async()=>root.render(<LanguageProvider><Fields/></LanguageProvider>));
  const input=host.querySelector<HTMLInputElement>('input')!,name=()=>[...input.labels!].map(label=>label.textContent).join(' ');
  expect(input.value).toBe('l23610');expect(name()).toBe('Search Source, Sub1, ADV1 or ADV2');expect(input.placeholder).toBe(name());
  const reset=host.querySelector<HTMLButtonElement>('.sourceSearchField button')!;expect(reset.getAttribute('aria-label')).toBe('Reset source search');reset.focus();await act(async()=>reset.click());
  expect(input.value).toBe('');expect(document.activeElement).toBe(input);expect(name()).toBe('Search Source, Sub1, ADV1 or ADV2');expect(location.search).toBe('?period=30d');expect(location.hash).toBe('#campaign-2');
  await act(async()=>host.querySelector<HTMLButtonElement>('#de')!.click());expect(name()).toBe('Source, Sub1, ADV1 oder ADV2 suchen');
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals()}
});
