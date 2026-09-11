import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import {buildSmartlinkInsight,smartlinkHistoryWindow,type CampaignShape,type SmartlinkReportRow} from './smartlink';
import {localizeDisplayText,translateText} from './i18n';
import AffiliateSmartlinks from '@/app/affiliates/AffiliateSmartlinks';

vi.mock('next/navigation',()=>({usePathname:()=>'/affiliates',useSearchParams:()=>new URLSearchParams('period=30d'),useRouter:()=>({push:vi.fn()})}));
const now=new Date('2026-08-20T12:00:00Z');
const shape:CampaignShape={network_campaign_id:7,campaign_name:'Fixture campaign',campaign_status:'active',redirect_routing_type:'weight',time_saved:Date.parse('2026-08-19T10:00:00Z')/1000,relationship:{redirects:{entries:[{redirect_network_offer_id:9,redirect_network_offer_url_id:27,routing_value:1}]}}};
const daily=(date:string,url:string,profit:number):SmartlinkReportRow=>({columns:[{column_type:'date',id:date,label:date},{column_type:'hour',id:String(Date.parse(`${date}T00:00:00Z`)/1000),label:date},{column_type:'campaign',id:'7',label:'Fixture campaign'},{column_type:'affiliate',id:'42',label:'Fixture partner'},{column_type:'offer',id:'9',label:'Fixture offer'},{column_type:'offer_url',id:url,label:`Fixture LP ${url}`}],reporting:{total_click:10,cv:2,revenue:profit,payout:0,profit}});
const insight=()=>buildSmartlinkInsight(shape,[daily('2026-08-08','26',20),daily('2026-08-20','27',3)],[],now);

describe('historical Smartlink figures keep their own window',()=>{
  it('keeps hourly history distinct and does not fall back to the current maturity window for old caches',()=>{
    const hourly=daily('2026-08-08','26',20);hourly.columns=hourly.columns.filter(column=>column.column_type!=='date');
    expect(buildSmartlinkInsight(shape,[hourly],[],now).windows.history).toBe('Historie · 14 Tage rollierend');
    expect(smartlinkHistoryWindow({sourceLegacy:'Verified history'})).toBe('Verified history');
    expect(smartlinkHistoryWindow({})).toBe('Historisches 14-Tage-Fenster · genaue Grenzen nicht verfügbar');
  });
  it('translates the complete dated history label and its partial-today note',()=>{
    const de='Letzte 14 Kalendertage · 07.08.–20.08.2026 · heute bis Datenstand';
    const en='Last 14 calendar days · 07/08–20/08/2026 · today through the latest data';
    expect(localizeDisplayText(translateText(de,'en'),'en')).toBe(en);
    expect(localizeDisplayText(translateText(en,'de'),'de')).toBe(de);
  });
  it('separates fourteen calendar days from the current rotation maturity window',()=>{
    const data=insight();
    expect(data.windows.maturity).toContain('20.08.–20.08.2026');
    expect(data.windows).toMatchObject({history:'Letzte 14 Kalendertage · 07.08.–20.08.2026 · heute bis Datenstand'});
    expect(data.currentSlots[0].metrics14.profit).toBe(3);
    expect(data.legacySlots[0].metrics14.profit).toBe(20);
    expect(data.mature14.profit).toBe(23);
  });
  it('labels both the campaign history and former LP history with the full metric window',()=>{
    const data=insight();
    const item={...data,selectedRange:{from:'2026-07-22',to:'2026-08-20',eventCoverageComplete:true}} as Parameters<typeof AffiliateSmartlinks>[0]['insights'][number];
    const html=renderToStaticMarkup(<AffiliateSmartlinks rebillAnalyses={{}} affiliateId="42" returnTo="/affiliates?period=30d" rangeLabel="22.07.–20.08.2026" selectedCampaignId={7} mappings={[{campaignId:7,campaign:'Fixture campaign',affiliateId:'42',affiliate:'Fixture partner',clicks30:20,sois30:4,revenue30:23,payout30:0,profit30:23,status:'active'}]} insights={[item]}/>);
    const doc=new JSDOM(html).window.document;
    const legacy=doc.querySelector('.legacyHistory');
    expect(legacy?.textContent).toContain('Letzte 14 Kalendertage · 07.08.–20.08.2026 · heute bis Datenstand');
    expect(legacy?.textContent).not.toContain('Reifefenster');
    const windows=doc.querySelector('.campaignKpiWindows')?.textContent||'';
    expect(windows).toContain('Letzte 14 Kalendertage · 07.08.–20.08.2026 · heute bis Datenstand');
    expect(windows).not.toContain('Reifefenster · 20.08.–20.08.2026');
  });
});
