// @vitest-environment jsdom
import React,{act,Suspense,use} from 'react';
import {createRoot,hydrateRoot,type Root} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import LanguageProvider from '@/app/components/LanguageProvider';
import LazyDetails from '@/app/affiliates/LazyDetails';
import {KpiValue} from '@/app/components/SmartlinkPresentation';

let root:Root|undefined;
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('React',React);
 vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});
 document.body.replaceChildren();document.documentElement.dataset.locale='en';
 history.replaceState({},'','/affiliates?affiliate=42&period=30d');
});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;vi.unstubAllGlobals()});

it('restores a URL-opened disclosure when a cached route mounts with its old closed default',async()=>{
 history.replaceState({},'','/affiliates?affiliate=42&period=30d&sourceOpen=url-27');
 const host=document.createElement('div');document.body.append(host);
 await act(async()=>{root=createRoot(host);root.render(<LazyDetails id="url-27" summary="Fixture LP"><p>Fixture detail</p></LazyDetails>)});
 expect(host.querySelector('details')?.open).toBe(true);
 expect(host.textContent).toContain('Fixture detail');
 expect(new URLSearchParams(location.search).get('period')).toBe('30d');
});

it('follows Back/Forward URL state and preserves unrelated disclosure IDs and filters',async()=>{
 const host=document.createElement('div');document.body.append(host);
 await act(async()=>{root=createRoot(host);root.render(<LazyDetails id="url-27" summary="Fixture LP"><p>Fixture detail</p></LazyDetails>)});
 await act(async()=>{history.replaceState({},'','/affiliates?affiliate=42&period=7d&sourceOpen=url-27,source-9');window.dispatchEvent(new PopStateEvent('popstate'))});
 expect(host.querySelector('details')?.open).toBe(true);
 expect(host.textContent).toContain('Fixture detail');
 await act(async()=>{history.replaceState({},'','/affiliates?affiliate=42&period=7d&sourceOpen=source-9');window.dispatchEvent(new PopStateEvent('popstate'))});
 expect(host.querySelector('details')?.open).toBe(false);
 const params=new URLSearchParams(location.search);
 expect(params.get('sourceOpen')).toBe('source-9');expect(params.get('period')).toBe('7d');
});

it('does not write an outgoing disclosure into the destination route when a delayed toggle fires',async()=>{
 const host=document.createElement('div');document.body.append(host);
 await act(async()=>{root=createRoot(host);root.render(<LazyDetails id="url-27" defaultOpen summary="Fixture LP"><p>Fixture detail</p></LazyDetails>)});
 await act(async()=>{history.replaceState({},'','/affiliates?period=30d');host.querySelector('details')!.dispatchEvent(new Event('toggle'))});
 expect(location.search).toBe('?period=30d');
});

it('persists an intentional summary click while preserving the current scope',async()=>{
 const host=document.createElement('div');document.body.append(host);
 await act(async()=>{root=createRoot(host);root.render(<LazyDetails id="url-27" summary="Fixture LP"><p>Fixture detail</p></LazyDetails>)});
 await act(async()=>host.querySelector('summary')!.click());
 expect(new URLSearchParams(location.search).get('sourceOpen')).toBe('url-27');
 expect(new URLSearchParams(location.search).get('affiliate')).toBe('42');
});

it('hydrates a delayed disclosure summary before applying persisted English',async()=>{
 let delayed=false,resolve!:()=>void;const ready=new Promise<void>(done=>{resolve=done});
 function Deferred(){if(delayed)use(ready);return <LazyDetails id="url-27" summary={<><b>BEOBACHTEN</b><strong>Ohne Landingpage-Zuordnung</strong><small>123,45 €</small></>}><p>Fixture detail</p></LazyDetails>}
 const tree=<LanguageProvider><Suspense fallback={<p>Bitte warten</p>}><Deferred/></Suspense></LanguageProvider>;
 const host=document.createElement('div');host.innerHTML=renderToString(tree);document.body.append(host);delayed=true;
 const recoverable=vi.fn();await act(async()=>{root=hydrateRoot(host,tree,{onRecoverableError:recoverable})});
 await act(async()=>resolve());
 expect(recoverable.mock.calls.map(args=>String(args[0]))).toEqual([]);
 expect(host.querySelector('summary strong')?.textContent).toBe('No landing-page assignment');
 expect(host.querySelector('summary small')?.textContent).toBe('€123.45');
});

it('localizes nested KPI components inside the protected disclosure summary',async()=>{
 const tree=<LanguageProvider><LazyDetails id="campaign-7" summary={<KpiValue label="Umsatz" value="123,45 €" detail="2 SOIs aus 10 Klicks" scope="07.08.–20.08.2026"/>}>Fixture detail</LazyDetails></LanguageProvider>;
 const host=document.createElement('div');host.innerHTML=renderToString(tree);document.body.append(host);
 await act(async()=>{root=hydrateRoot(host,tree)});
 expect(host.querySelector('.sharedKpi > span')?.textContent).toBe('Revenue');
 expect(host.querySelector('.sharedKpi > strong')?.textContent).toBe('€123.45');
 expect(host.querySelector('.sharedKpi > small')?.textContent).toBe('2 SOIs from 10 clicks');
});
