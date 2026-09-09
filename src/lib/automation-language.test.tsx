// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import LanguageProvider,{useLanguage} from '../app/components/LanguageProvider';
import AutomationDashboard from '../app/automation/AutomationDashboard';
vi.mock('next/navigation',()=>({useSearchParams:()=>new URLSearchParams()}));
let root:Root|undefined;
const payload={generatedAt:'2026-09-09T19:00:00Z',canRunLive:true,configurations:[{id:'fixture',version:5,name:'Entwurf speichern',affiliateId:436,campaignId:146,testMode:'single_offer',strategy:'equal_slots',status:'hold',writeEnabled:false,offers:[],slots:[{offerUrlId:2749,offerUrlName:'Neue Automation konfigurieren',weight:100}],thresholds:{targetSois:50,minClicks:500,maturityHours:336},schedule:{intervalMinutes:120},runs:[],updatedAt:'2026-09-09T19:00:00Z',lastIncident:{at:'2026-09-09T19:00:00Z',message:'Berlin-Tagesdaten müssen neu synchronisiert werden (6/14 Tage bestätigt)',providerMutated:false,compensation:'not_needed'}}],campaigns:[{campaignId:2,affiliateId:6,name:'Entwurf speichern',affiliate:'Neue Automation konfigurieren',mode:'none',lastStatus:'error',lastRunAt:'2026-09-09T19:00:00Z',nextRunAt:'2026-09-09T20:00:00Z',enabled:false,latest:{verified:true,action:'none',summary:'Entwurf speichern'}}]};
beforeEach(()=>{vi.stubGlobal('React',React);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});document.body.replaceChildren();document.documentElement.dataset.locale='en';vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>payload}))});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;vi.unstubAllGlobals()});
function Switch(){const{setLocale}=useLanguage();return <button id="de" onClick={()=>setLocale('de')}>DE</button>}
it('localizes loaded controls and hold state while preserving names and legacy audit text',async()=>{
 const host=document.createElement('div');document.body.append(host);root=createRoot(host);
 await act(async()=>root!.render(<LanguageProvider><Switch/><AutomationDashboard/></LanguageProvider>));
 expect(host.querySelector('.automationHero h2')?.textContent).toBe('Configure and control tests safely');
 expect(host.querySelector('.automationBuilder summary')?.textContent).toBe('Configure new automation');
 expect(host.querySelector('.configStatus')?.textContent).toBe('Safety hold');
 expect(host.querySelector('.automationConfig header h2')?.textContent).toBe('Entwurf speichern');
 expect(host.querySelector('.slotList span')?.textContent).toBe('Neue Automation konfigurieren');
 expect(host.querySelector('.legacyAutomationList p')?.textContent).toBe('Neue Automation konfigurieren · none · Entwurf speichern');
 expect(host.querySelector('.offerSearch input')?.getAttribute('aria-label')).toBe('Search by offer ID or name');
 expect(host.querySelector('.configIncident')?.textContent).toContain('Provider changed: no');
 expect(host.querySelector('button.primaryAction')?.textContent).toBe('Save draft');
 await act(async()=>host.querySelector<HTMLButtonElement>('#de')!.click());
 expect(host.querySelector('.automationBuilder summary')?.textContent).toBe('Neue Automation konfigurieren');
 expect(host.querySelector('.automationConfig header h2')?.textContent).toBe('Entwurf speichern');
 expect(vi.mocked(fetch).mock.calls).toHaveLength(1);expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBeUndefined();
});
it('announces a failed read and provides a read-only retry',async()=>{
 vi.mocked(fetch).mockRejectedValueOnce(new Error('Read unavailable'));
 const host=document.createElement('div');document.body.append(host);root=createRoot(host);
 await act(async()=>root!.render(<LanguageProvider><AutomationDashboard/></LanguageProvider>));
 expect(host.querySelector('[role="alert"] h2')?.textContent).toBe('Data could not be loaded');
 const retry=Array.from(host.querySelectorAll('button')).find(button=>button.textContent==='Try again');expect(retry).toBeDefined();
 await act(async()=>retry!.click());expect(host.querySelector('.automationBuilder')).not.toBeNull();
 expect(vi.mocked(fetch).mock.calls.every(([,options])=>options?.method===undefined)).toBe(true);
});
