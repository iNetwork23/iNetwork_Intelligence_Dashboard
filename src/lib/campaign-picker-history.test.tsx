// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import CampaignPicker from '../app/smartlinks/CampaignPicker';
import {buildCampaignOptions} from './campaign-picker';
vi.mock('next/link',()=>({default:(props:React.ComponentProps<'a'>)=><a {...props}/>}));
const campaigns=buildCampaignOptions([{network_campaign_id:2,campaign_name:'Partner Six',campaign_status:'active',network_tracking_domain_id:null,redirects:[]},{network_campaign_id:3,campaign_name:'Unassigned',campaign_status:'active',network_tracking_domain_id:null,redirects:[]}],[{campaignId:2,campaign:'Partner Six',affiliateId:'6',affiliate:'Six',clicks30:1,sois30:1,revenue30:1,payout30:0,profit30:1,status:'active'}]);
let root:Root|undefined;
beforeEach(()=>{vi.stubGlobal('React',React);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);document.body.replaceChildren();window.history.replaceState({},'','/affiliates?mode=smartlinks');});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;vi.unstubAllGlobals();});
async function mount(initialPartner?:string,initialOpen?:string){const host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root!.render(<CampaignPicker campaigns={campaigns} initialPartner={initialPartner} initialOpen={initialOpen}/>));return host;}

it('restores the current browser URL when a cached directory remounts after popstate already fired',async()=>{
  const first=await mount();
  await act(async()=>{const select=first.querySelector('select')!;select.value='6';select.dispatchEvent(new Event('change',{bubbles:true}));});
  await act(async()=>first.querySelector<HTMLButtonElement>('article>button')!.click());
  const returnUrl=location.pathname+location.search;
  await act(async()=>root!.unmount());root=undefined;
  window.history.replaceState({},'','/affiliates?affiliate=6&campaign=2');
  window.history.replaceState({},'',returnUrl);
  window.dispatchEvent(new PopStateEvent('popstate'));
  const restored=await mount(); // Cached server props still describe the original all-partner URL.
  expect(restored.querySelector('select')!.value).toBe('6');
  expect(restored.querySelector('button[aria-expanded="true"]')?.textContent).toContain('Partner Six');
  expect(restored.textContent).not.toContain('Unassigned');
});

it('honors live history while mounted and permits clearing a server-provided partner and disclosure',async()=>{
  window.history.replaceState({},'','/affiliates?mode=smartlinks&partner=6&open=2&q=Six');
  const host=await mount('6','2');
  await act(async()=>{window.history.replaceState({},'','/affiliates?mode=smartlinks&partner=unassigned');window.dispatchEvent(new PopStateEvent('popstate'));});
  expect(host.querySelector('select')!.value).toBe('unassigned');
  expect(host.querySelector('input')!.value).toBe('');
  expect(host.textContent).toContain('Unassigned');
  await act(async()=>{const select=host.querySelector('select')!;select.value='all';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(host.querySelector('select')!.value).toBe('all');
  expect(host.querySelector('button[aria-expanded="true"]')).toBeNull();
  expect(host.textContent).toContain('Partner Six');
});

it('allows all-partner selection without losing the surrounding affiliate and date context',async()=>{
  window.history.replaceState({},'','/affiliates?mode=smartlinks&affiliate=6&period=7d');
  const host=await mount('6');
  expect(host.querySelector('select')!.value).toBe('6');
  await act(async()=>{const select=host.querySelector('select')!;select.value='all';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(host.querySelector('select')!.value).toBe('all');
  expect(host.textContent).toContain('Unassigned');
  const params=new URLSearchParams(location.search);
  expect(params.get('affiliate')).toBe('6');expect(params.get('period')).toBe('7d');
});
