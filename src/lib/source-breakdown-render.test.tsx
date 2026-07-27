import{readFileSync}from'node:fs';import{join}from'node:path';import React from'react';import{renderToStaticMarkup}from'react-dom/server';import{describe,expect,it}from'vitest';import SourceBreakdown from'../app/affiliates/SourceBreakdown';import type{ConversionMetric,SourceBreakdownRow}from'./source-breakdown';
const metric:ConversionMetric={clicks:0,sois:3,cvr:0,firstSales:1,firstSaleRate:100/3,rebills:2,coinSpend:0,payout:30,revenue:60,profit:30,profitPerSoi:10};const rows:SourceBreakdownRow[]=[{pathKey:'8|7|0|2673',offerId:'8',affiliateId:'7',offerUrlId:'2673',sourceId:'P-3591625022',subSource:'creative-17',today:metric,days7:metric,days30:metric}];
describe('SourceBreakdown copy integration',()=>{
 it('renders a copy action for the tracked Source group',()=>{const html=renderToStaticMarkup(<SourceBreakdown rows={rows}/>);expect(html).toContain('Source P-3591625022 kopieren')});
 it('renders a copy action for the clickless ADV1 group',()=>{const html=renderToStaticMarkup(<SourceBreakdown rows={rows} apiMode/>);expect(html).toContain('ADV1 P-3591625022 kopieren')});
 it('uses Sub1 and ADV2 labels for the deepest values',()=>{const source=readFileSync(join(process.cwd(),'src/app/affiliates/SourceBreakdown.tsx'),'utf8');expect(source).toContain("label={apiMode?'ADV2':'Sub1'}");expect(source).toContain('value={leaf.subSource}')});
});
