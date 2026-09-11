// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import LanguageProvider,{useLanguage} from '../app/components/LanguageProvider';
import {LandingpageSourceBreakdown,SmartlinkRotationCards} from '../app/components/SmartlinkPresentation';
import {CampaignPeriodOverview} from '../app/affiliates/AffiliateSmartlinks';
import type {SmartSlot} from './smartlink';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()}),usePathname:()=>'/affiliates',useSearchParams:()=>new URLSearchParams()}));
const metrics={clicks:20,sois:4,cvr:20,firstSales:1,firstSaleRate:25,rebills:1,coinSpend:1,revenue:20,payout:10,profit:10,profitEpc:.5};
const rows=['Source A','Source B'].map(source=>({mode:'tracked' as const,source,subSource:'Sub A',...metrics,sois:2}));
const coverage={from:'2026-09-11',to:'2026-09-11',acceptedFrom:'2026-09-11',acceptedTo:'2026-09-11',acceptedDays:1,expectedDays:1,missingDays:[]};
const slot:SmartSlot={id:'3052',name:'Test LP',offerId:'57',weight:100,status:'active',metrics24:metrics,metrics72:metrics,metrics14:metrics,hoursTo50Sois:12,sourceBreakdown:rows,sourceCoverage:coverage};
function Switch(){const{setLocale}=useLanguage();return <><button id="de" onClick={()=>setLocale('de')}>DE</button><button id="en" onClick={()=>setLocale('en')}>EN</button></>}

it('translates real React source-count nodes and period hints through DE/EN switches',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});document.documentElement.dataset.locale='en';
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<LanguageProvider><Switch/><main><CampaignPeriodOverview rangeLabel="30 Tage" total={metrics} slots={[slot]} maturityWindow="Heute"/><SmartlinkRotationCards slots={[slot]} recommendations={[]} rotationLabel="Referenz" windows={{traffic:'Heute',economics:'Kurztrend',maturity:'Heute'}} campaignId="2"/><LandingpageSourceBreakdown rows={rows} scope="Heute" totalSois={4} landingpageId="3052" coverage={coverage}/></main></LanguageProvider>));
  const check=()=>{expect(host.querySelector('.lpOverviewSources header b')?.textContent).toBe('2 source combinations');expect(host.querySelector('.lpSourceBreakdown summary small')?.textContent).toContain('2 source combinations');expect(host.querySelector('.campaignPeriodOverview')?.textContent).toContain('available as verified source snapshots · requested: 11/09/2026–11/09/2026.');};
  check();await act(async()=>host.querySelector<HTMLButtonElement>('#de')!.click());expect(host.querySelector('.lpOverviewSources header b')?.textContent).toBe('2 Quellenkombinationen');
  await act(async()=>host.querySelector<HTMLButtonElement>('#en')!.click());check();expect(host.textContent).toContain('Source A');expect(host.textContent).toContain('Source B');
 }finally{await act(async()=>root.unmount());host.remove()}
});
