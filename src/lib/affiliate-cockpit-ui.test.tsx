import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('next/navigation',()=>({usePathname:()=>'/affiliates',useSearchParams:()=>new URLSearchParams('period=30d'),useRouter:()=>({push:vi.fn()})}));
import TrendList from '@/app/affiliates/TrendList';
import type {CockpitRow} from '@/lib/affiliate-trend';

const row=(key:string,profit:number):CockpitRow=>({affiliateId:'154',affiliate:'Partner 154',variantKey:key,offerId:'20',offer:'Offer 20',offerUrlId:key,offerUrl:`URL ${key}`,profit,sois:30,reason:`Grund ${key}`,trendVerdict:{status:'ok',profitDelta:profit,profitPercent:12,direction:'steigend'}});

describe('TrendList',()=>{
  it('renders every row without truncating',()=>{
    const rows=Array.from({length:37},(_,i)=>row(`v${i}`,-i));
    const html=renderToStaticMarkup(<TrendList title="Verluste" kicker="PROFIT" rows={rows} emptyReason="x" rangeParams="period=30d" mode="profit"/>);
    for(const r of rows)expect(html).toContain(`URL ${r.variantKey}`);
  });
  it('shows the row count',()=>{
    const html=renderToStaticMarkup(<TrendList title="Verluste" kicker="PROFIT" rows={[row('a',-5)]} emptyReason="x" rangeParams="period=30d" mode="profit"/>);
    expect(html).toContain('1 Position');
  });
  it('explains an empty list instead of rendering nothing',()=>{
    const html=renderToStaticMarkup(<TrendList title="Verluste" kicker="PROFIT" rows={[]} emptyReason="Keine Position unter der Reifeschwelle" rangeParams="period=30d" mode="profit"/>);
    expect(html).toContain('Keine Position unter der Reifeschwelle');
  });
});

import AffiliateCockpit from '@/app/affiliates/AffiliateCockpit';
import type {AffiliateAnalysisWithTrend} from '@/lib/affiliate-trend';

const analyses:AffiliateAnalysisWithTrend[]=[];

describe('AffiliateCockpit',()=>{
  it('renders all three lists',()=>{
    const html=renderToStaticMarkup(<AffiliateCockpit analyses={analyses} rangeParams="period=30d" comparisonAvailable/>);
    expect(html).toContain('Verluste');
    expect(html).toContain('Skalieren');
    expect(html).toContain('Veränderung');
  });
  it('states why the change list is missing for the 365 day period',()=>{
    const html=renderToStaticMarkup(<AffiliateCockpit analyses={analyses} rangeParams="period=all" comparisonAvailable={false}/>);
    expect(html).toContain('Kein Vergleichszeitraum in der 365-Tage-Historie');
  });
});
