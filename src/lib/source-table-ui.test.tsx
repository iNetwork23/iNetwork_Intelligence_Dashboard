import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('next/navigation',()=>({usePathname:()=>'/affiliates',useSearchParams:()=>new URLSearchParams(''),useRouter:()=>({push:vi.fn()})}));
import SourceBreakdown from '@/app/affiliates/SourceBreakdown';
import type {ConversionMetric,SourceBreakdownRow} from '@/lib/source-breakdown';
import {sourceRowBlockKeys,type SourceBlockMarkerIndex} from '@/lib/source-block-markers';

const metric=(x:Partial<ConversionMetric>):ConversionMetric=>({clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,payout:0,revenue:0,profit:0,profitPerSoi:0,...x});
const activity={lastLeadDate:'2026-08-22',asOf:'2026-08-23',coverageComplete:true,lookbackDays:365};
const row=(sourceId:string,subSource:string):SourceBreakdownRow=>({
  pathKey:'20|154|0|1',offerId:'20',affiliateId:'154',offerUrlId:'1',sourceId,subSource,
  trafficMode:'tracked',mainValue:sourceId,subValue:subSource,
  today:metric({}),days7:metric({}),days30:metric({clicks:300,sois:30,profit:90}),activity,
});
const rows=[row('Source A','sub-1'),row('Source A','sub-2'),row('Source A','sub-3'),row('Source B','sub-9')];

describe('source breakdown visibility',()=>{
  it('renders every source and sub-source without interaction',()=>{
    const html=renderToStaticMarkup(<SourceBreakdown rows={rows}/>);
    for(const text of ['Source A','Source B','sub-1','sub-2','sub-3','sub-9'])
      expect(html).toContain(text);
  });
  it('does not hide sources behind a collapsed details element',()=>{
    const html=renderToStaticMarkup(<SourceBreakdown rows={rows}/>);
    expect(html).not.toContain('<details');
  });
});

describe('shared verdict vocabulary',()=>{
  it('every source view uses the same verdient/verbrennt classes',async()=>{
    const {readFileSync}=await import('node:fs');
    for(const file of ['src/app/affiliates/SourceBreakdown.tsx','src/app/components/SmartlinkPresentation.tsx']){
      const source=readFileSync(file,'utf8');
      expect(source).toMatch(/verdient/);
      expect(source).toMatch(/verbrennt/);
    }
    const css=readFileSync('src/app/globals.css','utf8');
    for(const cls of ['.sourceGroupPanel.verbrennt','.provisionalSourceGroup.verbrennt','.lpSourceRanking>.lpSourceGroupRow.verbrennt'])
      expect(css).toContain(cls);
  });
  it('marks a burning direct source group with the shared verdict class and text',()=>{
    const burning=[row('Source A','sub-1')].map(r=>({...r,days30:{...r.days30,profit:-120}}));
    const html=renderToStaticMarkup(<SourceBreakdown rows={burning}/>);
    expect(html).toContain('sourceGroupPanel verbrennt');
    expect(html).toContain('Verbrennt Geld');
  });
});

describe('Sperrstatus in der Quellenauswertung (Etappe 2)',()=>{
  const marker=(key:string,status:'active'|'error'|'inactive'):SourceBlockMarkerIndex=>({[key]:{id:`b-${status}`,status,effectiveAt:'2026-09-03T08:15:00.000Z',affiliateId:'154',offerId:'20'}});
  const keys=(mainValue:string,subValue?:string)=>sourceRowBlockKeys({affiliateId:'154',offerId:'20',trafficMode:'tracked',mainValue,subValue});
  const render=(blocks:SourceBlockMarkerIndex|undefined,canManage:boolean)=>renderToStaticMarkup(<SourceBreakdown rows={rows} blocks={blocks} canManage={canManage} affiliateName="Partner" offerName="Offer"/>);
  it('zeigt „Gesperrt seit“ auf der gesperrten Unterquelle und rendert dort keinen Sperrknopf mehr',()=>{
    const html=render(marker(keys('Source A','sub-1')[0],'active'),true);
    expect(html).toContain('Gesperrt seit 03.09.2026');
    expect(html).toContain('<a class="blockMarker active" href="/source-blocks">Gesperrt seit 03.09.2026</a>');
    expect(html).not.toContain('Sub1 sub-1: Vergütung sperren');
    expect(html).toContain('Sub1 sub-2: Vergütung sperren');
    expect(html).toContain('Source Source A: Vergütung sperren');
    expect(html.match(/Gesperrt seit/g)).toHaveLength(1);
  });
  it('markiert eine gesperrte Hauptquelle im Kopf, verlinkt im Sperrbereich und deckt ihre Unterquellen ab',()=>{
    const html=render(marker(keys('Source A')[0],'active'),true);
    expect(html).toContain('sourceGroupPanel verdient blocked');
    expect(html).toContain('<span class="blockMarker active">Gesperrt seit 03.09.2026</span>');
    expect(html).not.toContain('Source Source A: Vergütung sperren');
    expect(html).not.toContain('Sub1 sub-1: Vergütung sperren');
    expect(html).toContain('Source Source B: Vergütung sperren');
  });
  it('zeigt unklare Sperren als „Zustand unklar“ (STATE_WORDS) und ohne Link für Rollen ohne Sperrrecht',()=>{
    const html=render(marker(keys('Source A','sub-1')[0],'error'),false);
    expect(html).toContain('<span class="blockMarker unclear">Zustand unklar</span>');
    expect(html).not.toContain('href="/source-blocks"');
    expect(html).not.toContain('Vergütung sperren</span>');
  });
  it('rendert ohne Index oder bei inaktiven Datensätzen unverändert Sperrknöpfe',()=>{
    expect(render(undefined,true)).not.toContain('blockMarker');
    const inactive=render(marker(keys('Source A','sub-1')[0],'inactive'),true);
    expect(inactive).not.toContain('blockMarker');
    expect(inactive).toContain('Sub1 sub-1: Vergütung sperren');
  });
});
