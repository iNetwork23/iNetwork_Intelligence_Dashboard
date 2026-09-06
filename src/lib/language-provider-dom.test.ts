// @vitest-environment jsdom
import React,{act}from'react';
import{createRoot,hydrateRoot,type Root}from'react-dom/client';
import{afterEach,beforeEach,describe,expect,it,vi}from'vitest';
import{renderToString}from'react-dom/server';
import TranslatedText from'../app/components/TranslatedText';
import LanguageProvider,{useLanguage}from'../app/components/LanguageProvider';
let root:Root;
function Toggle(){const{setLocale}=useLanguage();return React.createElement('button',{id:'switch',onClick:()=>setLocale('en')},'EN')}
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('React',React);document.body.replaceChildren();document.documentElement.dataset.locale='de';vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn(),removeItem:vi.fn()})});
afterEach(async()=>{if(root)await act(async()=>root.unmount());vi.unstubAllGlobals()});
async function mount(content:React.ReactNode){const host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(React.createElement(LanguageProvider,null,React.createElement(Toggle),content)))}
async function english(){await act(async()=>{(document.querySelector('#switch')as HTMLButtonElement).click()})}
describe('language provider DOM traversal',()=>{
 it('continues into following ancestors after a nested excluded subtree',async()=>{
  await mount(React.createElement(React.Fragment,null,
   React.createElement('section',null,React.createElement('code',null,'Anmelden')),
   React.createElement('main',null,React.createElement('p',{id:'copy'},'Geschützter Zugriff für Mitarbeitende und Partner.'),React.createElement('button',{id:'login'},'Anmelden'))));
  await english();
  expect(document.querySelector('#login')?.textContent).toBe('Sign in');
  expect(document.querySelector('#copy')?.textContent).toBe('Protected access for employees and partners.');
  expect(document.querySelector('code')?.textContent).toBe('Anmelden');
 });
 it('keeps dynamically inserted protected text and attributes unchanged',async()=>{
  await mount(React.createElement('div',{'data-no-translate':true,id:'protected'}));await english();
  await act(async()=>{const span=document.createElement('span');span.textContent='Anmelden';span.setAttribute('title','Anmelden');document.querySelector('#protected')!.append(span)});
  expect(document.querySelector('#protected span')?.textContent).toBe('Anmelden');
  expect(document.querySelector('#protected span')?.getAttribute('title')).toBe('Anmelden');
 });
});

describe('React-owned login translations',()=>{
 it('hydrates German server text in a persisted English session without a mismatch',async()=>{
  const content=React.createElement(LanguageProvider,null,React.createElement('main',{'data-no-translate':true},React.createElement(TranslatedText,null,'Anmelden')));
  const host=document.createElement('div');host.innerHTML=renderToString(content);document.body.append(host);
  document.documentElement.dataset.locale='en';const recoverable=vi.fn();
  await act(async()=>{root=hydrateRoot(host,content,{onRecoverableError:recoverable})});
  expect(host.textContent).toBe('Sign in');expect(recoverable).not.toHaveBeenCalled();
 });
});
