// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import AccessConsole from '../app/admin/access/AccessConsole';
import LanguageProvider from '../app/components/LanguageProvider';

let root:Root;
const user={id:'qa-scoped',email:'qa@example.invalid',username:'qa-scoped',status:'active',lastLogin:null,access:{role:'employee',status:'active',version:3,grants:[],denials:[],scopes:{affiliate:['6']}}};
const writes:Record<string,unknown>[]=[];
const button=(label:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===label)!;
const dialog=()=>document.querySelector<HTMLDialogElement>('[aria-labelledby="access-confirm-title"]')!;
beforeEach(async()=>{
  writes.length=0;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('React',React);
  vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});
  vi.stubGlobal('fetch',vi.fn(async(_url,options)=>{
    if(options?.method==='POST')writes.push(JSON.parse(options.body));
    return{ok:true,json:async()=>({users:[user],roles:[],permissions:[]})};
  }));
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
  HTMLDialogElement.prototype.close=function(){if(this.open){this.removeAttribute('open');this.dispatchEvent(new Event('close'))}};
  window.matchMedia=vi.fn(()=>({matches:false})) as unknown as typeof window.matchMedia;
  window.history.replaceState(null,'','/admin/access?view=users');
  document.body.replaceChildren();document.documentElement.dataset.locale='en';
  const host=document.createElement('div');document.body.append(host);
  await act(async()=>{root=createRoot(host);root.render(<LanguageProvider><AccessConsole/></LanguageProvider>)});
});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals()});

it('previews the target and keeps cancellation and Escape free of writes',async()=>{
  await act(async()=>button('Revoke sessions').click());
  expect(dialog().open).toBe(true);
  expect(dialog().textContent).toContain('qa@example.invalid');
  expect(dialog().textContent).toContain('Confirm action');
  expect(writes).toEqual([]);
  await act(async()=>button('Cancel').click());
  expect(dialog().open).toBe(false);
  await act(async()=>button('Revoke sessions').click());
  await act(async()=>dialog().dispatchEvent(new Event('cancel',{cancelable:true})));
  expect(dialog().open).toBe(false);
  expect(writes).toEqual([]);
});

it('sends the captured target exactly once only after confirmation',async()=>{
  await act(async()=>button('Revoke sessions').click());
  await act(async()=>{button('Confirm').click();button('Confirm').click()});
  expect(writes).toEqual([{action:'revoke_sessions',userId:'qa-scoped'}]);
  expect(dialog().open).toBe(false);
});

it('preserves the expected version and renders a rejected operation',async()=>{
  vi.mocked(fetch).mockImplementation(async(_url,options)=>{
    if(options?.method==='POST'){
      writes.push(JSON.parse(String(options.body)));
      return{ok:false,json:async()=>({error:'Version conflict'})} as Response;
    }
    return{ok:true,json:async()=>({users:[user],roles:[],permissions:[]})} as Response;
  });
  await act(async()=>button('Disable').click());
  expect(writes).toHaveLength(0);
  await act(async()=>button('Confirm').click());
  expect(writes).toEqual([{action:'deactivate',userId:'qa-scoped',expectedVersion:3}]);
  expect(document.body.textContent).toContain('Version conflict');
});

it('cancels a pending confirmation when the console unmounts',async()=>{
  await act(async()=>button('Revoke sessions').click());
  await act(async()=>root.unmount());
  expect(writes).toHaveLength(0);
});
