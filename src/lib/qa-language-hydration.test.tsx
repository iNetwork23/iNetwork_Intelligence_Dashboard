// @vitest-environment jsdom
import React,{act,Suspense,use} from 'react';
import {hydrateRoot,type Root} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import LanguageProvider,{useLanguage} from '../app/components/LanguageProvider';
import LocalizedMain from '../app/components/LocalizedMain';
import CampaignPicker from '../app/smartlinks/CampaignPicker';
import AccessDeniedHint from '../app/components/AccessDeniedHint';
import type {CampaignOption} from './campaign-picker';
vi.mock('next/navigation',()=>({usePathname:()=>'/affiliates',useRouter:()=>({push:vi.fn()}),useSearchParams:()=>new URLSearchParams()}));
vi.mock('next/link',()=>({default:({prefetch,...props}:React.ComponentProps<'a'>&{prefetch?:boolean})=>{void prefetch;return <a {...props}/>}}));
let root:Root|undefined;
beforeEach(()=>{vi.stubGlobal('React',React);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});document.body.replaceChildren();document.documentElement.dataset.locale='en';window.history.replaceState({},'','/affiliates?open=2');});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;vi.unstubAllGlobals()});
const campaign:CampaignOption={network_campaign_id:2,campaign_name:'App installieren',campaign_status:'active',activeLandingpageCount:1,network_tracking_domain_id:3,partners:[{id:'6',name:'Deutsch'}],redirects:[{offerId:57,offerUrlId:2792,name:'Standard',weight:100,status:'active'}]};
it.each(['picker','denial'] as const)('hydrates the delayed %s, switches language and preserves business identities',async kind=>{
 let delayed=false,resolve!:()=>void;const ready=new Promise<void>(done=>{resolve=done});
 function Deferred(){if(delayed)use(ready);return kind==='picker'?<CampaignPicker campaigns={[campaign]} initialOpen="2"/>:<AccessDeniedHint permission="campaigns.edit"/>}
 function Switch(){const{setLocale}=useLanguage();return <button id="de" onClick={()=>setLocale('de')}>DE</button>}
 const tree=<LanguageProvider><Switch/><LocalizedMain><Suspense fallback={<p>Bitte warten</p>}><Deferred/></Suspense></LocalizedMain></LanguageProvider>;
 const host=document.createElement('div');host.innerHTML=renderToString(tree);document.body.append(host);delayed=true;const errors=vi.fn();
 await act(async()=>{root=hydrateRoot(host,tree,{onRecoverableError:errors})});await act(async()=>resolve());
 expect(errors.mock.calls.map(call=>String(call[0]))).toEqual([]);
 if(kind==='picker'){
  expect(host.textContent).toContain('SMARTLINKS AND PARTNERS');expect(host.textContent).toContain('Open partner in Affiliate Optimizer');
  expect(host.querySelector('.campaignIdentity strong')?.textContent).toBe('App installieren');expect(host.querySelector('.campaignRedirectList b')?.textContent).toBe('Standard');expect(host.querySelector('.campaignPartners span')?.textContent).toBe('Deutsch');
  expect(host.querySelector('select option[value="6"]')?.textContent).toContain('Deutsch');
 }else expect(host.textContent).toContain('Missing permission: campaigns.edit');
 await act(async()=>host.querySelector<HTMLButtonElement>('#de')!.click());
 expect(host.textContent).toContain(kind==='picker'?'SMARTLINKS UND PARTNER':'Fehlende Berechtigung: campaigns.edit');
});
