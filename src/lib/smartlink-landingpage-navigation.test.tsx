// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,hydrateRoot,type Root} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import LanguageProvider from '@/app/components/LanguageProvider';
import {SmartlinkRotationCards} from '@/app/components/SmartlinkPresentation';
import type {SmartSlot,SlotRecommendation} from './smartlink';
import {localizeDisplayText,translateText} from './i18n';

const metrics={clicks:100,sois:10,cvr:10,firstSales:1,firstSaleRate:10,rebills:2,coinSpend:3,revenue:20,payout:10,profit:10,profitEpc:.1};
const slots:SmartSlot[]=['26','27'].map(id=>({id,name:`Fixture LP ${id}`,offerId:'9',weight:50,status:'active',metrics24:metrics,metrics72:metrics,metrics14:metrics,hoursTo50Sois:12.5,sourceBreakdown:[]}));
const recs:SlotRecommendation[]=slots.map(slot=>({slotId:slot.id,action:'protect',severity:'warning',reasonCode:'cvr_floor',title:'2,5-%-CVR schützen',detail:'Noch keine belastbare Empfehlung.'}));
const cards=(campaignId='7')=><SmartlinkRotationCards campaignId={campaignId} slots={slots} recommendations={recs} rotationLabel="Fixture rotation" windows={{traffic:'Heute',economics:'Kurztrend',maturity:'Fixture maturity'}}/>;
const query='?affiliate=42&mode=smartlinks&campaign=7&period=30d&sourcePeriod=7d';
let root:Root|undefined,host:HTMLDivElement;
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('React',React);
 vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});
 vi.stubGlobal('requestAnimationFrame',vi.fn(()=>1));vi.stubGlobal('cancelAnimationFrame',vi.fn());
 document.body.replaceChildren();document.documentElement.dataset.locale='de';
 history.replaceState({fixture:'preserved'},'','/affiliates'+query);
 host=document.createElement('div');document.body.append(host);
});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;vi.unstubAllGlobals();vi.restoreAllMocks()});
const mount=async(tree=cards())=>{await act(async()=>{root=createRoot(host);root.render(tree)})};
const selected=()=>host.querySelector('.lpDetailRegion')?.id;

it('hydrates a fresh deep link into the requested landing page without a mismatch',async()=>{
 history.replaceState(history.state,'','/affiliates'+query+'#lp-detail-7-27');
 const tree=<LanguageProvider>{cards()}</LanguageProvider>,onRecoverableError=vi.fn();
 host.innerHTML=renderToString(tree);
 await act(async()=>{root=hydrateRoot(host,tree,{onRecoverableError})});
 expect(selected()).toBe('lp-detail-7-27');
 expect(host.querySelector('[aria-controls="lp-detail-7-27"]')?.getAttribute('aria-pressed')).toBe('true');
 expect(onRecoverableError).not.toHaveBeenCalled();
});

it('scrolls only after the requested landing-page detail has committed',async()=>{
 const original=HTMLElement.prototype.scrollIntoView,scroll=vi.fn();
 Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{value:scroll,configurable:true});
 vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{callback(0);return 1});
 try{
  history.replaceState(history.state,'','/affiliates'+query+'#lp-detail-7-27');
  await mount();
  expect(scroll.mock.instances.map(element=>(element as HTMLElement).id)).toContain('lp-detail-7-27');
 }finally{Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{value:original,configurable:true})}
});

it('puts an intentional LP selection in history and preserves all scope parameters',async()=>{
 await mount();const push=vi.spyOn(history,'pushState');
 await act(async()=>host.querySelector<HTMLButtonElement>('[aria-controls="lp-detail-7-27"]')!.click());
 expect(selected()).toBe('lp-detail-7-27');expect(location.hash).toBe('#lp-detail-7-27');
 expect(location.search).toBe(query);expect(history.state.fixture).toBe('preserved');
 expect(push).toHaveBeenCalledTimes(1);
 await act(async()=>host.querySelector<HTMLButtonElement>('[aria-controls="lp-detail-7-27"]')!.click());
 expect(push).toHaveBeenCalledTimes(1);
});

it('restores Back/Forward and anchor navigation into the visible landing-page workspace',async()=>{
 await mount();
 const sourceTab=host.querySelectorAll<HTMLButtonElement>('.campaignWorkspaceTabs button')[1];
 await act(async()=>sourceTab.click());
 await act(async()=>{history.replaceState(history.state,'','/affiliates'+query+'#lp-detail-7-27');window.dispatchEvent(new HashChangeEvent('hashchange'))});
 expect(selected()).toBe('lp-detail-7-27');
 expect(host.querySelector('.campaignWorkspaceTabs button')?.getAttribute('aria-selected')).toBe('true');
 await act(async()=>{history.replaceState(history.state,'','/affiliates'+query+'#lp-detail-7-26');window.dispatchEvent(new PopStateEvent('popstate'))});
 expect(selected()).toBe('lp-detail-7-26');
 await act(async()=>{history.replaceState(history.state,'','/affiliates'+query+'#lp-detail-7-27');window.dispatchEvent(new PopStateEvent('popstate'))});
 expect(selected()).toBe('lp-detail-7-27');
});

it('only resolves an existing landing page inside its own campaign',async()=>{
 history.replaceState(history.state,'','/affiliates'+query+'#lp-detail-8-27');
 await mount(<>{cards('7')}{cards('8')}</>);
 expect([...host.querySelectorAll('.lpDetailRegion')].map(e=>e.id)).toEqual(['lp-detail-7-26','lp-detail-8-27']);
 await act(async()=>{history.replaceState(history.state,'','/affiliates'+query+'#lp-detail-7-999');window.dispatchEvent(new HashChangeEvent('hashchange'))});
 expect(host.querySelector('#lp-detail-7-999')).toBeNull();
 expect(host.querySelector('#lp-detail-7-26')).not.toBeNull();
});

it('renders the complete selected-LP warning, forecast and CVR guardrail in English',async()=>{
 document.documentElement.dataset.locale='en';
 await mount(<LanguageProvider>{cards()}</LanguageProvider>);
 const detail=host.querySelector('.lpDetailRegion')!;
 expect(detail.textContent).toContain('Landing-page profit');
 expect(detail.textContent).toContain('Different period from campaign profit · do not add');
 expect(detail.textContent).toContain('12.5 hours');
 expect(detail.querySelector('.sharedStatusBadge')?.getAttribute('aria-label')).toContain('Protect the 2.5% CVR floor');
 expect(detail.textContent).not.toContain('Std.');
 await act(async()=>host.querySelector<HTMLButtonElement>('[aria-controls="lp-detail-7-27"]')!.click());
 expect(selected()).toBe('lp-detail-7-27');
 expect(host.querySelector('.lpDetailRegion')?.textContent).toContain('Different period from campaign profit · do not add');
});

it('round-trips decimal thresholds and forecast hours without altering business names',()=>{
 for(const [de,en] of [['2,5-%-CVR schützen','Protect the 2.5% CVR floor'],['1.012,5 Std.','1,012.5 hours']]){
  expect(localizeDisplayText(translateText(de,'en'),'en')).toBe(en);
  expect(localizeDisplayText(translateText(en,'de'),'de')).toBe(de);
 }
 expect(translateText('Fixture 12,5 Std. campaign','en')).toBe('Fixture 12,5 Std. campaign');
});
