// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import FraudStopForm from '../app/fraud/FraudStopForm';
const {refresh}=vi.hoisted(()=>({refresh:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh})}));
let host:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal('React',React);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);refresh.mockReset();host=document.createElement('div');document.body.append(host);root=createRoot(host)});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals()});
async function fill(){await act(async()=>root.render(<FraudStopForm/>));const form=host.querySelector('form')!;form.querySelector<HTMLInputElement>('[name="affiliateId"]')!.value='6';form.querySelector<HTMLInputElement>('[name="requestedAt"]')!.value='2026-09-09T12:00';return form;}
it('resets the successful form and refreshes after the response arrives outside the submit event',async()=>{
 let finish!:(response:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve})));
 const form=await fill();await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(form.querySelector('button')!.disabled).toBe(true);
 await act(async()=>finish({ok:true,json:async()=>({id:'local-test'})} as Response));
 expect(host.querySelector('[role="status"]')?.textContent).toBe('Abbestellung gespeichert. Die 24-Stunden-Kontrolle läuft read-only.');
 expect(form.querySelector<HTMLInputElement>('[name="affiliateId"]')!.value).toBe('');expect(refresh).toHaveBeenCalledOnce();expect(form.querySelector('button')!.disabled).toBe(false);
});
it('keeps the input and reports a rejected response without refreshing',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,json:async()=>({error:'Kontrollierter Testfehler'})})));
 const form=await fill();await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(host.querySelector('[role="status"]')?.textContent).toBe('Kontrollierter Testfehler');expect(form.querySelector<HTMLInputElement>('[name="affiliateId"]')!.value).toBe('6');expect(refresh).not.toHaveBeenCalled();expect(form.querySelector('button')!.disabled).toBe(false);
});
