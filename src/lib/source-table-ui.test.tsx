import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('next/navigation',()=>({usePathname:()=>'/affiliates',useSearchParams:()=>new URLSearchParams(''),useRouter:()=>({push:vi.fn()})}));
import SourceBreakdown from '@/app/affiliates/SourceBreakdown';
import type {ConversionMetric,SourceBreakdownRow} from '@/lib/source-breakdown';

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
