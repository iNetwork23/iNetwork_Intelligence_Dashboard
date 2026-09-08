// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
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
