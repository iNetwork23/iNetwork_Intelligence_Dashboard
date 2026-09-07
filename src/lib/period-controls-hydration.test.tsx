// @vitest-environment jsdom
import React,{act,Suspense,use} from 'react';
import {hydrateRoot,type Root} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import LanguageProvider,{useLanguage} from '../app/components/LanguageProvider';
import PeriodControls,{type PeriodControlsProps} from '../app/components/PeriodControls';

const push=vi.hoisted(()=>vi.fn());
vi.mock('next/navigation',()=>({usePathname:()=>'/affiliates',useSearchParams:()=>new URLSearchParams('affiliate=154&period=30d'),useRouter:()=>({push})}));
let root:Root|undefined;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('React',React);vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});document.body.replaceChildren();document.documentElement.dataset.locale='en';push.mockClear()});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;vi.unstubAllGlobals()});
const defaults:PeriodControlsProps={dimension:'global',period:'30d',rangeLabel:'09.08.–07.09.2026',maxDate:'2026-09-07'};

it.each([{name:'global',props:{}},{name:'compact',props:{compact:true}},{name:'source',props:{dimension:'source' as const}}])('hydrates delayed $name period controls before applying English',async({props})=>{
 let delayed=false,resolve!:()=>void;
 const ready=new Promise<void>(done=>{resolve=done});
 function Deferred(){if(delayed)use(ready);const control=<PeriodControls {...defaults} {...props}/>;return props.dimension==='source'?<details open id="url-57"><summary>Source</summary>{control}</details>:control}
 function German(){const{setLocale}=useLanguage();return <button id="switch-de" onClick={()=>setLocale('de')}>DE</button>}
 const tree=<LanguageProvider><German/><Suspense fallback={<p>Bitte warten</p>}><Deferred/></Suspense></LanguageProvider>;
 const host=document.createElement('div');host.innerHTML=renderToString(tree);document.body.append(host);delayed=true;
 const recoverable=vi.fn();await act(async()=>{root=hydrateRoot(host,tree,{onRecoverableError:recoverable})});
 await act(async()=>resolve());
 expect(recoverable.mock.calls.map(args=>String(args[0]))).toEqual([]);
 if(!props.compact){
  const monthButton=[...host.querySelectorAll('button')].find(button=>button.textContent?.includes('year/month'));
  await act(async()=>monthButton!.click());
  expect(host.querySelector('.dashboardMonthPicker')).not.toBeNull();
  const previous=host.querySelector<HTMLButtonElement>('[aria-label="Previous year"]');
  expect(previous).not.toBeNull();
  await act(async()=>previous!.click());
  expect(host.querySelector<HTMLSelectElement>('.dashboardMonthYear select')?.value).toBe('2025');
  const customButton=[...host.querySelectorAll('button')].find(button=>button.textContent?.includes('Individual'));
  await act(async()=>customButton!.click());
  expect(host.querySelector('input[name="from"]')?.getAttribute('type')).toBe('date');
  expect(host.querySelector('input[name="to"]')?.getAttribute('max')).toBe('2026-09-07');
 }
 const preset=[...host.querySelectorAll('button')].find(button=>button.textContent==='7 days');
 expect(preset).toBeDefined();
 await act(async()=>preset!.click());
 expect(push).toHaveBeenCalledWith(props.dimension==='source'?'/affiliates?affiliate=154&period=30d&sourcePeriod=7d&sourceOpen=url-57#url-57':'/affiliates?affiliate=154&period=7d',{scroll:false});
 await act(async()=>host.querySelector<HTMLButtonElement>('#switch-de')!.click());
 expect([...host.querySelectorAll('button')].some(button=>button.textContent==='7 Tage')).toBe(true);
});
