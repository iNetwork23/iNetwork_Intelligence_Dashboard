// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import SourceBlockButton from '../app/affiliates/SourceBlockButton';
import LanguageProvider from '../app/components/LanguageProvider';
import {translateText} from './i18n';

let host:HTMLDivElement,root:Root;
const props={affiliateId:'154',affiliateName:'Partner unverändert',offerId:'73',offerName:'Offer unverändert',trafficMode:'tracked' as const,level:'main_source' as const,mainValue:'l202534',metrics:{payout:54.6,sois:78,profit:-54.6,clicks:0,firstSales:0,maturity:'43 von 78 SOIs reif · Schwelle 50',leadStatus:'Heute aktiv',trend:'Profit – (unter Reifeschwelle (≥ 100 Klicks oder ≥ 20 SOIs)) · 7 Tage vs. 7 Tage davor'}};
beforeEach(()=>{
 vi.stubGlobal('React',React);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({blocks:[]})})));
 vi.stubGlobal('requestAnimationFrame',vi.fn(()=>1));vi.stubGlobal('cancelAnimationFrame',vi.fn());
 document.documentElement.dataset.locale='de';document.body.style.overflow='auto';
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals()});
async function mount(locale='de'){
 document.documentElement.dataset.locale=locale;
 await act(async()=>root.render(<LanguageProvider><SourceBlockButton {...props}/><button id="outside">Outside</button></LanguageProvider>));
 const opener=host.querySelector<HTMLButtonElement>('.sourceBlockIconButton')!;
 await act(async()=>{opener.focus();opener.click()});return opener;
}
async function key(element:Element,key:string,shiftKey=false){await act(async()=>element.dispatchEvent(new KeyboardEvent('keydown',{key,shiftKey,bubbles:true,cancelable:true})))}
it('keeps Tab and Shift+Tab inside the dialog and returns focus on Escape',async()=>{
 const opener=await mount(),close=document.querySelector<HTMLButtonElement>('.sourceBlockClose')!,cancel=document.querySelector<HTMLButtonElement>('.sourceBlockCancel')!;
 expect(document.activeElement).toBe(close);expect(document.body.style.overflow).toBe('hidden');
 await key(close,'Tab',true);expect(document.activeElement).toBe(cancel);
 await key(cancel,'Tab');expect(document.activeElement).toBe(close);
 await act(async()=>host.querySelector<HTMLButtonElement>('#outside')!.focus());expect(document.activeElement).toBe(close);
 await key(close,'Escape');expect(document.querySelector('[role="dialog"]')).toBeNull();expect(document.activeElement).toBe(opener);expect(document.body.style.overflow).toBe('auto');
 expect(vi.mocked(fetch).mock.calls.every(([,options])=>!options?.method||options.method==='GET')).toBe(true);
});
it('returns focus after cancel and removes its focus guard',async()=>{
 const opener=await mount();await act(async()=>document.querySelector<HTMLButtonElement>('.sourceBlockCancel')!.click());
 expect(document.activeElement).toBe(opener);
 const outside=host.querySelector<HTMLButtonElement>('#outside')!;outside.focus();expect(document.activeElement).toBe(outside);
});
it('renders the English scope, maturity, trend and effect without changing source IDs or enabling submission',async()=>{
 await mount('en');const dialog=document.querySelector('[role="dialog"]')!;
 expect(dialog.textContent).toContain('Source: Block payout');expect(dialog.textContent).toContain('43 of 78 SOIs mature · threshold 50 · Active today');
 expect(dialog.textContent).toContain('below maturity threshold');expect(dialog.textContent).toContain('7 days vs. the previous 7 days');
 expect(dialog.textContent).toContain('Only the partner can stop incoming traffic.');expect(dialog.textContent).toContain('l202534');expect(dialog.textContent).toContain('Partner unverändert');
 expect(document.querySelector<HTMLButtonElement>('.sourceConfirmBlock')!.disabled).toBe(true);
});
it('translates only known scoped action messages and preserves the identity in both directions',()=>{
 for(const scope of ['Source','Sub1','ADV1','ADV2'])for(const action of ['Vergütung sperren','Sperre aufheben','Nach Everflow-Prüfung deaktivieren']){
  const de=`${scope} id: Sonderwert · 1.234: ${action}`,en=translateText(de,'en');expect(en).not.toBe(de);expect(en).toContain('id: Sonderwert · 1.234');expect(translateText(en,'de')).toBe(de);
 }
 expect(translateText('Partner Source überall sperren GmbH','en')).toBe('Partner Source überall sperren GmbH');
 expect(translateText('Source-Historie ist unvollständig. Keine Änderung durchgeführt.','en')).toBe('Source history is incomplete. No changes were made.');
});
it('keeps an unsuccessful across-offer preview disabled even after selecting a reason and displays its error inside the dialog',async()=>{
 await mount('en');await act(async()=>document.querySelector<HTMLButtonElement>('.sourceBlockCancel')!.click());
 vi.mocked(fetch).mockResolvedValueOnce({ok:false,json:async()=>({error:'Source-Historie ist unvollständig. Keine Änderung durchgeführt.'})} as Response);
 await act(async()=>host.querySelector<HTMLButtonElement>('.sourceBlockAllProductsButton')!.click());
 const dialog=document.querySelector('[role="dialog"]')!,reason=dialog.querySelector('select')!;
 await act(async()=>{reason.value='fraud';reason.dispatchEvent(new Event('change',{bubbles:true}))});
 expect(reason.value).toBe('fraud');
 expect(dialog.querySelector('[role="alert"]')?.textContent).toBe('Source history is incomplete. No changes were made.');
 expect(dialog.querySelector<HTMLButtonElement>('.sourceConfirmBlock')!.disabled).toBe(true);
 expect(vi.mocked(fetch).mock.calls.every(([,options])=>!options?.method||options.method==='GET')).toBe(true);
});
