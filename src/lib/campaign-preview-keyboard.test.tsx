// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import LanguageProvider from '../app/components/LanguageProvider';
import CampaignStatusButton from '../app/affiliates/CampaignStatusButton';
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}));

it('contains keyboard focus and restores the opener without sending a campaign change',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const fetch=vi.fn();vi.stubGlobal('fetch',fetch);document.documentElement.dataset.locale='de';
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<LanguageProvider><CampaignStatusButton campaignId={2} campaignName="TrafficPartner" initialStatus="active" canManage/></LanguageProvider>));
  const opener=host.querySelector<HTMLButtonElement>('button')!;opener.focus();await act(async()=>opener.click());
  const dialog=document.querySelector('[role=dialog]')!,buttons=dialog.querySelectorAll<HTMLButtonElement>('button'),first=buttons[0],last=buttons[buttons.length-1];
  first.focus();const backwards=new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true});await act(async()=>first.dispatchEvent(backwards));expect(backwards.defaultPrevented).toBe(true);expect(document.activeElement).toBe(last);
  const forwards=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});await act(async()=>last.dispatchEvent(forwards));expect(forwards.defaultPrevented).toBe(true);expect(document.activeElement).toBe(first);
  await act(async()=>first.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(document.querySelector('[role=dialog]')).toBeNull();expect(document.activeElement).toBe(opener);expect(fetch).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals()}
});

it('localizes the complete confirmation while retaining the campaign identity',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);document.documentElement.dataset.locale='en';
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<LanguageProvider><CampaignStatusButton campaignId={2} campaignName="Campaign pausieren Media" initialStatus="active" canManage/></LanguageProvider>));
  const opener=host.querySelector<HTMLButtonElement>('button')!;expect(opener.getAttribute('aria-label')).toBe('Pause campaign');await act(async()=>opener.click());
  const dialog=document.querySelector('[role=dialog]')!;expect(dialog.textContent).toContain('Campaign pausieren Media');expect(dialog.textContent).toContain('all affiliates and redirects');expect(dialog.textContent).toContain('Pause campaign now');expect(dialog.textContent).not.toContain('Kein garantierter');
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals()}
});
