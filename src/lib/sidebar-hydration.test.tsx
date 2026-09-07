// @vitest-environment jsdom
import React,{act,Suspense,use} from 'react';
import {hydrateRoot,type Root} from 'react-dom/client';
import {renderToString} from 'react-dom/server';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import LanguageProvider from '../app/components/LanguageProvider';
import AdminSidebar from '../app/components/AdminSidebar';

vi.mock('next/navigation',()=>({usePathname:()=>'/',useSearchParams:()=>new URLSearchParams('period=30d')}));
vi.mock('next/link',()=>({default:({prefetch:_,...props}:React.ComponentProps<'a'>&{prefetch?:boolean})=>React.createElement('a',props)}));
let root:Root|undefined;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('React',React);vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});document.body.replaceChildren();document.documentElement.dataset.locale='en';document.documentElement.dataset.theme='dark'});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;vi.unstubAllGlobals()});

it('hydrates the delayed account navigation before translating its text and controls',async()=>{
 let delayed=false,resolve!:()=>void;
 const ready=new Promise<void>(done=>{resolve=done});
 function Deferred(){if(delayed)use(ready);return <AdminSidebar email="qa" role="super_admin" impersonating={false} actorId="qa" mayStatistics mayFraud mayPartners mayAutomation maySourceBlocks maySources sourcesBadge={18} sourceBlocksBadge={1} maySmartlinks mayAdmin maySecurity maySettings oneSignalConfigured={false} capabilityLabel="Sperren · Campaigns" writeAccess/>}
 const tree=<LanguageProvider><Suspense fallback={<p>Bitte warten</p>}><Deferred/></Suspense></LanguageProvider>;
 const host=document.createElement('div');host.innerHTML=renderToString(tree);document.body.append(host);delayed=true;
 const recoverable=vi.fn();await act(async()=>{root=hydrateRoot(host,tree,{onRecoverableError:recoverable})});
 await act(async()=>resolve());
 expect(recoverable.mock.calls.map(args=>String(args[0]))).toEqual([]);
 expect(host.querySelector('aside')?.getAttribute('aria-label')).toBe('Main navigation');
 expect(host.querySelector('a[href="/cohorts?period=30d"]')?.textContent).toBe('LTV cohorts');
 expect(host.querySelector('.brandMark')?.textContent).toBe('ME');
 expect(host.querySelector('form[action="/api/auth/logout"] button')?.textContent).toBe('Log out');
 const theme=host.querySelector<HTMLButtonElement>('[data-theme-toggle="icon"]')!;
 expect(theme.getAttribute('aria-label')).toBe('Enable light theme');
 await act(async()=>theme.click());
 expect(document.documentElement.dataset.theme).toBe('light');
 expect(theme.getAttribute('aria-label')).toBe('Enable dark theme');
 await act(async()=>host.querySelector<HTMLButtonElement>('.sidebarCollapse')!.click());
 expect(host.querySelector('aside')?.getAttribute('data-sidebar-collapsed')).toBe('true');
 expect(host.querySelector('.sidebarCollapse')?.getAttribute('aria-expanded')).toBe('false');
 await act(async()=>host.querySelector<HTMLButtonElement>('.sidebarNavHeader button')!.click());
 expect(host.querySelectorAll('.sidebarOrderItem')).toHaveLength(6);
 expect(host.querySelector('aside')?.getAttribute('data-sidebar-collapsed')).toBe('false');
 await act(async()=>host.querySelector<HTMLButtonElement>('.sidebarNavHeader button')!.click());
 await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Deutsch"]')!.click());
 expect(host.querySelector('aside')?.getAttribute('aria-label')).toBe('Hauptnavigation');
 expect(host.querySelector('a[href="/cohorts?period=30d"]')?.textContent).toBe('LTV-Kohorten');
 expect(host.querySelector('form[action="/api/auth/logout"] button')?.textContent).toBe('Abmelden');
 expect(theme.getAttribute('aria-label')).toBe('Dunkles Design aktivieren');
 await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="English"]')!.click());
 expect(host.querySelector('a[href="/cohorts?period=30d"]')?.textContent).toBe('LTV cohorts');
 expect(recoverable).not.toHaveBeenCalled();
});
