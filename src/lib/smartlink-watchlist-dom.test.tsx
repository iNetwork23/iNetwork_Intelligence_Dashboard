// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import SmartlinkWatchlist from '../app/smartlinks/SmartlinkWatchlist';
vi.mock('../app/affiliates/InstantLink',()=>({default:(props:React.ComponentProps<'a'>)=><a {...props}/>}));
let root:Root|undefined;let saved:string|null=null;
beforeEach(()=>{vi.stubGlobal('React',React);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);saved=null;vi.stubGlobal('localStorage',{getItem:()=>saved,setItem:(_key:string,value:string)=>{saved=value}});document.body.replaceChildren()});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;vi.unstubAllGlobals()});
async function mount(affiliateId:string){const host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root!.render(<SmartlinkWatchlist current={{id:3,name:'No mapped partner',affiliateId}} affiliateId={affiliateId} baseHref="/affiliates?mode=smartlinks&period=90d&affiliate=20"/>));return host}
it('saves an unmapped campaign without inventing affiliate 0 and preserves the period',async()=>{
 const host=await mount('0');await act(async()=>host.querySelector<HTMLButtonElement>('.favoriteToggle')!.click());
 const url=new URL(host.querySelector('a')!.getAttribute('href')!,'https://dashboard.local');
 expect(url.pathname).toBe('/smartlinks');expect(url.searchParams.get('campaign')).toBe('3');expect(url.searchParams.get('affiliate')).toBeNull();expect(url.searchParams.get('period')).toBe('90d');
 expect(JSON.parse(saved!)).toEqual([{id:3,name:'No mapped partner'}]);
});
it('repairs a stored zero sentinel on read and lets the current favorite be removed',async()=>{
 saved=JSON.stringify([{id:3,name:'No mapped partner',affiliateId:'0'}]);const host=await mount('0');
 expect(host.querySelector<HTMLButtonElement>('.favoriteToggle')!.getAttribute('aria-pressed')).toBe('true');
 expect(host.querySelector('a')!.getAttribute('href')).not.toContain('affiliate=0');
 await act(async()=>host.querySelector<HTMLButtonElement>('.favoriteToggle')!.click());expect(saved).toBe('[]');
});
it('keeps a real saved affiliate separate from the current page context',async()=>{
 const host=await mount('436');await act(async()=>host.querySelector<HTMLButtonElement>('.favoriteToggle')!.click());
 const url=new URL(host.querySelector('a')!.getAttribute('href')!,'https://dashboard.local');expect(url.pathname).toBe('/affiliates');expect(url.searchParams.get('affiliate')).toBe('436');expect(url.searchParams.get('period')).toBe('90d');
});
