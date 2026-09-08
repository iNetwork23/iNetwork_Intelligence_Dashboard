// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import AdminSidebar from '../app/components/AdminSidebar';
import LanguageProvider from '../app/components/LanguageProvider';

vi.mock('next/navigation',()=>({usePathname:()=>'/',useSearchParams:()=>new URLSearchParams('period=7d')}));
vi.mock('next/link',()=>({default:(props:React.ComponentProps<'a'>&{prefetch?:boolean})=>{const{prefetch,...rest}=props;void prefetch;return <a {...rest}/>}}));
let root:Root|undefined,host:HTMLDivElement;
let change:()=>void,media:{matches:boolean;addEventListener:ReturnType<typeof vi.fn>;removeEventListener:ReturnType<typeof vi.fn>};
beforeEach(()=>{
 vi.stubGlobal('React',React);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 vi.stubGlobal('localStorage',{getItem:()=>null,setItem:vi.fn()});
 media={matches:true,addEventListener:vi.fn((_event:string,listener:()=>void)=>{change=listener}),removeEventListener:vi.fn()};
 vi.stubGlobal('matchMedia',()=>media);document.documentElement.dataset.locale='de';
 host=document.createElement('div');document.body.append(host);
});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;host.remove();vi.unstubAllGlobals()});
async function mount(){
 await act(async()=>{root=createRoot(host);root.render(<LanguageProvider><AdminSidebar email="qa" role="super_admin" impersonating={false} actorId="qa" mayStatistics mayFraud mayPartners mayAutomation maySourceBlocks maySources sourcesBadge={0} sourceBlocksBadge={0} maySmartlinks mayAdmin maySecurity maySettings oneSignalConfigured={false} capabilityLabel="Lesen" writeAccess/><button id="background-action">Content action</button></LanguageProvider>)});
}
async function open(){await act(async()=>host.querySelector<HTMLButtonElement>('.mobileSidebarToggle')!.click())}

it('makes the closed mobile drawer inert and supplies pre-hydration CSS visibility protection',async()=>{
 await mount();expect(host.querySelector('aside')?.hasAttribute('inert')).toBe(true);
 const css=readFileSync('src/app/globals.css','utf8');
 expect(css).toMatch(/@media\(max-width:760px\)\{\.adminSidebar:not\(\.mobileOpen\)\{visibility:hidden\}/);
});
it('focuses a visible close control, traps keyboard focus and restores the opener on Escape',async()=>{
 await mount();await open();
 const aside=host.querySelector('aside')!,close=host.querySelector<HTMLButtonElement>('.mobileSidebarClose')!;
 expect(aside.hasAttribute('inert')).toBe(false);expect(aside.getAttribute('role')).toBe('dialog');expect(aside.getAttribute('aria-modal')).toBe('true');
 expect(document.activeElement).toBe(close);
 await act(async()=>close.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true})));
 expect(document.activeElement).toBe(host.querySelector('form[action="/api/auth/logout"] button'));
 await act(async()=>document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true})));
 expect(document.activeElement).toBe(close);
 await act(async()=>host.querySelector<HTMLButtonElement>('#background-action')!.focus());
 expect(document.activeElement).toBe(close);
 await act(async()=>close.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
 expect(host.querySelector('aside')?.hasAttribute('inert')).toBe(true);
 expect(document.activeElement).toBe(host.querySelector('.mobileSidebarToggle'));
});
it('closes by button and keeps desktop navigation available after a breakpoint change',async()=>{
 await mount();await open();
 await act(async()=>host.querySelector<HTMLButtonElement>('.mobileSidebarClose')!.click());
 expect(document.activeElement).toBe(host.querySelector('.mobileSidebarToggle'));
 await open();await act(async()=>{media.matches=false;change()});
 const aside=host.querySelector('aside')!;
 expect(aside.hasAttribute('inert')).toBe(false);expect(aside.hasAttribute('aria-modal')).toBe(false);
 expect(aside.classList.contains('mobileOpen')).toBe(false);
});
