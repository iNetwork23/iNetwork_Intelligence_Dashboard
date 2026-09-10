// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import Preview from '../app/affiliates/SourceBlockProviderPreview';
const language=vi.hoisted(()=>({locale:'en'}));
vi.mock('../app/components/LanguageProvider',()=>({useHydratedLocale:()=>language.locale}));
const identity={affiliateId:'6',affiliateName:'Partner',offerId:'56',offerName:'Offer',trafficMode:'tracked' as const,level:'main_source' as const,mainValue:null};
const preview={checkedAt:'2026-09-10T10:00:00Z',operation:'create',matchingSettingIds:[],affiliateId:6,offerId:56,trafficMode:'tracked',variables:[{variable:'source_id',variable_value:'',comparison_method:'not_present'}]};
let root:Root,host:HTMLDivElement;
beforeEach(async()=>{language.locale='en';vi.stubGlobal('React',React);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({preview})}));host=document.createElement('div');document.body.append(host);await act(async()=>{root=createRoot(host);root.render(<Preview identity={identity}/>)})});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals()});
it('does not fetch until requested and uses only GET with the exact source identity',async()=>{
 expect(fetch).not.toHaveBeenCalled();await act(async()=>host.querySelector('button')!.click());
 expect(fetch).toHaveBeenCalledTimes(1);const[url,init]=vi.mocked(fetch).mock.calls[0];expect(init).toMatchObject({method:'GET',cache:'no-store'});
 const params=new URL(String(url),'https://example.test').searchParams;expect(Object.fromEntries(params)).toEqual({action:'preview_provider',affiliateId:'6',affiliateName:'Partner',offerId:'56',offerName:'Offer',trafficMode:'tracked',level:'main_source'});
 expect(host.textContent).toContain('No matching rule exists.');expect(host.textContent).toContain('source_id: not supplied (not_present)');expect(host.textContent).toContain('Traffic continues.');
});
it('clears an old successful preview when a refresh fails and allows a retry',async()=>{
 await act(async()=>host.querySelector('button')!.click());vi.mocked(fetch).mockResolvedValueOnce({ok:false,json:async()=>({error:'internal detail'})} as Response);
 await act(async()=>host.querySelector('button')!.click());expect(host.querySelector('[role=status]')).toBeNull();expect(host.querySelector('[role=alert]')?.textContent).toContain('Retry before confirming.');expect(host.textContent).not.toContain('internal detail');expect(host.querySelector('button')?.disabled).toBe(false);
});
it('explains the reporting prerequisite separately from a provider failure',async()=>{
 vi.mocked(fetch).mockResolvedValueOnce({ok:false,json:async()=>({code:'source_history_incomplete'})} as Response);
 await act(async()=>host.querySelector('button')!.click());expect(host.querySelector('[role=alert]')?.textContent).toContain('Complete the history import');expect(host.textContent).not.toContain('The provider state could not be fully checked');expect(host.querySelector('[role=status]')).toBeNull();
});
it('shows existing rule IDs in German and cancels the read when leaving the panel',async()=>{
 language.locale='de';vi.mocked(fetch).mockResolvedValueOnce({ok:true,json:async()=>({preview:{...preview,operation:'reuse',matchingSettingIds:[777]}})} as Response);
 await act(async()=>{root.render(<Preview identity={identity}/>)});await act(async()=>host.querySelector('button')!.click());expect(host.textContent).toContain('Vorhandene Setting-IDs: 777');expect(host.textContent).toContain('keine neue Testregel');
 const signal=vi.mocked(fetch).mock.calls[0][1]?.signal;await act(async()=>root.render(null));expect(signal?.aborted).toBe(true);
});
