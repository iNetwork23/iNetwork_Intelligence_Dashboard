// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import DealRegisterForm from '../app/settings/deals/DealRegisterForm';
import {DEFAULT_DEAL_RULES} from './deal-register';
vi.mock('../app/components/LocalizedRoot',()=>({default:({children}:{children:React.ReactNode})=>children}));
let root:Root|undefined;
beforeEach(()=>{vi.stubGlobal('React',React);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('fetch',vi.fn());document.body.replaceChildren()});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;vi.unstubAllGlobals()});
async function mount(loadError?:string){const host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root!.render(<DealRegisterForm initialRevision="opened-revision" initialRules={[...DEFAULT_DEAL_RULES]} initialSource="defaults" defaults={DEFAULT_DEAL_RULES} loadError={loadError}/>));return host}
const button=(host:HTMLElement,text:string)=>[...host.querySelectorAll('button')].find(item=>item.textContent===text)!;
async function fill(host:HTMLElement,label:string,value:string){const input=[...host.querySelectorAll('label')].find(item=>item.textContent?.startsWith(label))!.querySelector('input')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))})}
it('blocks saving default rules after the stored register failed to load',async()=>{
 const host=await mount('Register nicht geladen');await act(async()=>button(host,'Standardregeln übernehmen').click());
 expect(button(host,'Register speichern').disabled).toBe(true);
 await act(async()=>button(host,'Register speichern').click());expect(fetch).not.toHaveBeenCalled();
});
it('rejects adding an existing partner rule instead of silently replacing it',async()=>{
 const host=await mount();await fill(host,'Partner-ID','436');await fill(host,'Testquote (SOIs)','90');
 await act(async()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/bereits/);
 const row=[...host.querySelectorAll('tbody tr')].find(item=>item.firstElementChild?.textContent==='436')!;
 expect(row.textContent).toContain('50 SOIs');expect(row.textContent).not.toContain('90 SOIs');
 expect(fetch).not.toHaveBeenCalled();
});

it('preserves the draft on a conflict, sends its original revision and blocks repeat overwrites',async()=>{
 vi.mocked(fetch).mockResolvedValue({ok:false,status:409,json:async()=>({error:'Ein neuerer Stand ist bereits gespeichert.'})} as Response);
 const host=await mount();await act(async()=>button(host,'Standardregeln übernehmen').click());
 await act(async()=>button(host,'Register speichern').click());
 expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({expectedRevision:'opened-revision'});
 expect(host.querySelector('[role="alert"]')?.textContent).toContain('neuerer Stand');
 expect(host.querySelectorAll('tbody tr')).toHaveLength(DEFAULT_DEAL_RULES.length);expect(button(host,'Register speichern').disabled).toBe(true);
 await act(async()=>button(host,'Register speichern').click());expect(fetch).toHaveBeenCalledTimes(1);
 expect(host.querySelector('a')?.getAttribute('href')).toBe('/settings/deals');
});
it('uses the new revision after saving and exposes a failed audit instead of claiming complete success',async()=>{
 vi.mocked(fetch).mockResolvedValue({ok:true,status:200,json:async()=>({rules:[...DEFAULT_DEAL_RULES],revision:'saved-revision',audited:false})} as Response);
 const host=await mount();await act(async()=>button(host,'Standardregeln übernehmen').click());await act(async()=>button(host,'Register speichern').click());
 expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/Auditnachweis.*fehlgeschlagen/);
 await act(async()=>button(host,'Standardregeln übernehmen').click());await act(async()=>button(host,'Register speichern').click());
 expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body))).toMatchObject({expectedRevision:'saved-revision'});
});
it('still permits an explicit edit of the existing partner rule',async()=>{
 const host=await mount(),row=[...host.querySelectorAll('tbody tr')].find(item=>item.firstElementChild?.textContent==='436')!;
 await act(async()=>row.querySelector<HTMLButtonElement>('button')!.click());await fill(host,'Testquote (SOIs)','90');
 await act(async()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(host.querySelector('[role="alert"]')).toBeNull();expect([...host.querySelectorAll('tbody tr')].find(item=>item.firstElementChild?.textContent==='436')!.textContent).toContain('90 SOIs');
 expect(button(host,'Register speichern').disabled).toBe(false);expect(fetch).not.toHaveBeenCalled();
});
