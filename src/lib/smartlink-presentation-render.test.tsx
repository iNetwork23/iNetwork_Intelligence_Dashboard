import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {SmartlinkRotationCards} from '../app/components/SmartlinkPresentation';
import type {SmartSlot} from './smartlink';

const metrics={clicks:120,sois:12,cvr:10,firstSales:2,firstSaleRate:16.67,rebills:1,coinSpend:7,revenue:50,payout:96,profit:-46,profitEpc:-0.383};
const slot:SmartSlot={id:'2673',name:'Test LP',offerId:'8',weight:33.3,status:'active',metrics24:metrics,metrics72:metrics,metrics14:metrics,hoursTo50Sois:12,sourceBreakdown:[{mode:'tracked',source:'CD_DE_ZERO',subSource:'45',clicks:120,sois:12,cvr:10,firstSales:2,rebills:1,coinSpend:7,revenue:50,payout:96,profit:-46},{mode:'api',source:'campaign-a',subSource:'creative-b',clicks:0,sois:2,cvr:null,firstSales:1,rebills:0,coinSpend:3,revenue:25,payout:16,profit:9}]};

describe('SmartlinkRotationCards rendering',()=>{
 it('renders LP events and all tracked/API source combinations with their own scope',()=>{const html=renderToStaticMarkup(<SmartlinkRotationCards slots={[slot]} recommendations={[]} rotationLabel="Campaign-Speichertag als Referenz" windows={{traffic:'Heute',economics:'Letzte 3 Kalendertage',maturity:'Nach Referenztag',source:'Letzte 14 Kalendertage'}}/>);expect(html).toContain('2 Source-Kombinationen');expect(html).toContain('Coin-Spend-Events');expect(html).toContain('Source ID');expect(html).toContain('Subsource ID');expect(html).toContain('ADV1');expect(html).toContain('ADV2');expect(html).toContain('n/a – clickless');expect(html).toContain('Letzte 14 Kalendertage')});
 it('contains explicit small-screen wrapping and a horizontal source-table escape hatch',()=>{const css=readFileSync(join(process.cwd(),'src/app/globals.css'),'utf8');expect(css).toContain('.lpSourceTableWrap{max-width:100%;overflow-x:auto');expect(css).toContain('@media(max-width:600px)');expect(css).toContain('.sharedLpGrid{grid-template-columns:1fr}');expect(css).toContain('.profitExplanation{align-items:flex-start;flex-direction:column}')});
});
