// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import LanguageProvider,{useLanguage} from '../app/components/LanguageProvider';
import DealRegisterForm from '../app/settings/deals/DealRegisterForm';
import {DEFAULT_DEAL_RULES} from './deal-register';
let root:Root|undefined;
function LocaleSwitch(){const {setLocale}=useLanguage();return <><button onClick={()=>setLocale('de')}>DE</button><button onClick={()=>setLocale('en')}>EN</button></>}
beforeEach(()=>{vi.stubGlobal('React',React);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);document.body.replaceChildren();document.documentElement.dataset.locale='en';vi.stubGlobal('fetch',vi.fn())});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;vi.unstubAllGlobals()});
it.each([1,2])('keeps saved feedback and Berlin timestamps in the selected language for %i rules',async count=>{
 const saved=DEFAULT_DEAL_RULES.slice(0,count).map(rule=>({...rule,updatedAt:'2026-09-10T13:23:37.505Z',updatedBy:'legacy-admin'}));
 vi.mocked(fetch).mockResolvedValue({ok:true,status:200,json:async()=>({rules:saved,revision:'saved-revision',audited:true})} as Response);
 const host=document.createElement('div');document.body.append(host);root=createRoot(host);
 await act(async()=>root!.render(<LanguageProvider><LocaleSwitch/><DealRegisterForm initialRevision="defaults-revision" initialRules={[...DEFAULT_DEAL_RULES]} initialSource="defaults" defaults={DEFAULT_DEAL_RULES}/></LanguageProvider>));
 const button=(text:string)=>[...host.querySelectorAll('button')].find(el=>el.textContent===text)!;
 await act(async()=>button('Apply default rules').click());await act(async()=>button('Save register').click());
 expect(host.querySelector('.dealRegisterNotice.ok')?.textContent).toBe(`Saved · ${count} ${count===1?'rule':'rules'} active.`);
 expect(host.querySelector('tbody')?.textContent).toContain('10/09/2026, 15:23');
 expect(host.querySelectorAll('time[datetime="2026-09-10T13:23:37.505Z"]')).toHaveLength(count);
 expect(host.querySelector('.dealRegisterHint')?.textContent).toMatch(/^Stored register active/);
 await act(async()=>button('DE').click());
 expect(host.querySelector('.dealRegisterNotice.ok')?.textContent).toBe(`Gespeichert · ${count} ${count===1?'Regel':'Regeln'} aktiv.`);
 expect(host.querySelector('tbody')?.textContent).toContain('10.09.26, 15:23');
 await act(async()=>button('EN').click());
 expect(host.querySelector('.dealRegisterNotice.ok')?.textContent).toBe(`Saved · ${count} ${count===1?'rule':'rules'} active.`);
 expect(host.querySelector('tbody')?.textContent).toContain('10/09/2026, 15:23');
 expect(fetch).toHaveBeenCalledTimes(1);
 expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({expectedRevision:'defaults-revision'});
 expect(host.querySelector('tbody')?.textContent).toContain(saved[0].note);
});
