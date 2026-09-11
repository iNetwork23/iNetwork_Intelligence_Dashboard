// @vitest-environment jsdom
import React,{act,Suspense,use} from 'react';
import {createRoot,hydrateRoot,type Root} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import AccessConsole from '../app/admin/access/AccessConsole';
import PasswordSetup from '../app/auth/callback/page';
import LanguageProvider,{useLanguage} from '../app/components/LanguageProvider';
let root:Root|undefined,host:HTMLDivElement;
beforeEach(()=>{
 vi.stubGlobal('React',React);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({users:[],roles:[],permissions:[]})})));
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:vi.fn()});
 document.documentElement.dataset.locale='de';host=document.createElement('div');document.body.append(host);
 history.replaceState(null,'','/auth/callback#access_token='+'t'.repeat(40));
});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;host.remove();vi.restoreAllMocks();vi.unstubAllGlobals()});
async function mount(kind:string,locale:string){document.documentElement.dataset.locale=locale;await act(async()=>{root=createRoot(host);root.render(<LanguageProvider><LocaleSwitch/>{kind==='setup'?<PasswordSetup/>:<AccessConsole/>}</LanguageProvider>)});return host.querySelector<HTMLFormElement>(kind==='setup'?'form':'.inviteForm')!}
async function input(field:HTMLInputElement,value:string){await act(async()=>{field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}))})}
const good='Aa9!'+'🔐'.repeat(17),bad=good+'x';
function LocaleSwitch(){const{setLocale}=useLanguage();return <button id="switch-en" onClick={()=>setLocale('en')}>English</button>}
it.each(['provision','setup'])('%s keeps an existing native validation message aligned with a locale change',async kind=>{
 const form=await mount(kind,'de'),field=form.elements.namedItem('password') as HTMLInputElement;
 const untouched=form.elements.namedItem(kind==='setup'?'confirm':'passwordConfirm') as HTMLInputElement;
 expect(untouched.validity.customError).toBe(false);
 await input(field,bad);expect(field.validationMessage).toContain('Passwort zu lang');
 await act(async()=>host.querySelector<HTMLButtonElement>('#switch-en')!.click());
 expect(document.documentElement.dataset.locale).toBe('en');expect(field.validationMessage).toContain('Password is too long');
 expect(untouched.validity.customError).toBe(false);
 await input(field,good);expect(field.validity.valid).toBe(true);expect(field.value).toBe(good);
});
it('hydrates the delayed password setup form before translating it and keeps missing-token submission disabled',async()=>{
 history.replaceState(null,'','/auth/callback');document.documentElement.dataset.locale='en';
 let delayed=false,resolve!:()=>void;const ready=new Promise<void>(done=>{resolve=done});
 function Deferred(){if(delayed)use(ready);return <PasswordSetup/>}
 const tree=<LanguageProvider><Suspense fallback={<p>Bitte warten</p>}><Deferred/></Suspense></LanguageProvider>;
 host.innerHTML=renderToString(tree);delayed=true;const recoverable=vi.fn();
 await act(async()=>{root=hydrateRoot(host,tree,{onRecoverableError:recoverable})});await act(async()=>resolve());
 expect(recoverable.mock.calls.map(args=>String(args[0]))).toEqual([]);
 expect(host.querySelector('h1')?.textContent).toBe('Set up password');
 expect(host.querySelector('p')?.textContent).toBe('The link does not contain a valid access token.');
 expect(host.querySelector<HTMLButtonElement>('form button')?.disabled).toBe(true);
 expect([...host.querySelectorAll<HTMLInputElement>('input')].every(field=>field.value===''&&field.type==='password')).toBe(true);
 expect(fetch).not.toHaveBeenCalled();
});
