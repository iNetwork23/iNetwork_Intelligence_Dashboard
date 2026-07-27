import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {SmartlinkRotationCards} from '../app/components/SmartlinkPresentation';
import type {SmartSlot} from './smartlink';

const metrics={clicks:120,sois:12,cvr:10,firstSales:2,firstSaleRate:16.67,rebills:1,coinSpend:7,revenue:50,payout:96,profit:-46,profitEpc:-0.383};
const metrics72={...metrics,revenue:72,payout:33,profit:39};
const slot:SmartSlot={id:'2673',name:'Test LP',offerId:'8',weight:33.3,status:'active',metrics24:metrics,metrics72,metrics14:metrics,hoursTo50Sois:12,sourceBreakdown:[{mode:'tracked',source:'CD_DE_ZERO',subSource:'45',clicks:120,sois:10,cvr:8.33,firstSales:1,rebills:1,coinSpend:4,revenue:25,payout:80,profit:-55},{mode:'api',source:'campaign-a',subSource:'creative-b',clicks:0,sois:2,cvr:null,firstSales:1,rebills:0,coinSpend:3,revenue:25,payout:16,profit:9}]};
const renderCards=(value:SmartSlot=slot)=>renderToStaticMarkup(<SmartlinkRotationCards slots={[value]} recommendations={[]} rotationLabel="Campaign-Speichertag als Referenz" windows={{traffic:'Heute',economics:'Letzte 3 Kalendertage',maturity:'Nach Referenztag',source:'Letzte 14 Kalendertage'}}/>);

describe('SmartlinkRotationCards visual hierarchy',()=>{
 it('keeps every existing KPI and makes each subsection visibly belong to its LP',()=>{const html=renderCards();expect(html).toContain('LP #2673 · Sales und Nachzahlungen');expect(html).toContain('LP #2673 · Woher kommen die Leads?');expect(html).toContain('LP #2673 · Kosten, Umsatz und Prognose');for(const text of['Profit im Reifefenster','Anmelderate (CVR)','SOIs','First-Sales','Anteil SOI → First-Sale','Rebills','Coin-Spend-Events','Profit je Klick','Umsatz · Letzte 3 Kalendertage','SOI-Vergütung · Letzte 3 Kalendertage','Geschätzte Zeit bis 50 SOIs'])expect(html).toContain(text);expect(html).toContain('72,00');expect(html).toContain('33,00')});

 it('renders recommendations as clearly labelled read-only status instead of an action button',()=>{const html=renderCards();expect(html).toContain('Empfehlung: Halten');expect(html).toContain('role="status"');expect(html).toContain('class="sharedStatusBadge neutral"');expect(html).not.toContain('<button type="button" class="sharedStatusBadge')});

 it('preserves all source dimensions, API labels, shares and the visible control total',()=>{const html=renderCards();expect(html).toContain('2 Source-Kombinationen');expect(html).toContain('12 von 12 SOIs nach Herkunft zugeordnet');expect(html).toContain('10 SOIs · 83,3 %');expect(html).toContain('2 SOIs · 16,7 %');for(const text of['Source','Sub1','ADV1','ADV2','n/a – clickless','Letzte 14 Kalendertage','Lead-Herkunft für LP #2673</caption>'])expect(html).toContain(text);for(const label of['Source CD_DE_ZERO kopieren','Sub1 45 kopieren','ADV1 campaign-a kopieren','ADV2 creative-b kopieren'])expect(html).toContain(label)});

 it('adds responsive field labels to every source value without changing the table data',()=>{const html=renderCards();for(const label of['Klicks','SOIs · Anteil','CVR','First-Sales','Rebills','Coin-Spend-Events','Umsatz','SOI-Vergütung','Profit'])expect(html).toContain(`data-label="${label}"`)});

 it('uses the LP total as share denominator when source assignment is incomplete',()=>{const partial={...slot,sourceBreakdown:[slot.sourceBreakdown![0]]},html=renderCards(partial);expect(html).toContain('10 von 12 SOIs nach Herkunft zugeordnet');expect(html).toContain('10 SOIs · 83,3 %');expect(html).toContain('Abweichung prüfen');expect(html).not.toContain('10 SOIs · 100,0 %')});

 it('expands an opened source card across the LP grid and converts its table to cards before tablet overflow',()=>{const css=readFileSync(join(process.cwd(),'src/app/globals.css'),'utf8'),shared=readFileSync(join(process.cwd(),'src/app/components/SmartlinkPresentation.tsx'),'utf8');expect(css).toContain('.sharedLpCard.source-open{grid-column:1/-1');expect(css).toContain('.sharedLpCard:has(>.lpSourceBreakdown[open]){grid-column:1/-1');expect(css).not.toContain('.sharedLpCard.source-open,.sharedLpCard:has(');expect(shared).toContain("sourceOpen?' source-open':''");expect(shared).toContain('onOpenChange={setSourceOpen}');expect(css).toContain('.lpSourceTableWrap{overflow-x:auto;overflow-y:hidden');expect(css).toContain('@media(max-width:1100px){.lpSourceTableWrap{overflow:visible');expect(css).toContain('@media(max-width:900px){.sharedLpGrid,.sharedLpGrid.count-2{grid-template-columns:1fr}');expect(css).toContain('@media(max-width:420px)');expect(css).toContain('.lpSourceTable thead{display:none}');expect(css).toContain('.lpSourceTable tr{display:grid');expect(css).toContain('.lpSourceTable td:before{content:attr(data-label)');expect(css).toContain('.lpSourceTableWrap{overflow:visible');expect(css).not.toContain('min-width:1120px')});

 it('uses distinct restrained accents for sales, source and economics sections',()=>{const css=readFileSync(join(process.cwd(),'src/app/globals.css'),'utf8');expect(css).toContain('--lp-sales:');expect(css).toContain('--lp-source:');expect(css).toContain('--lp-economics:');expect(css).toContain('.lpEvidenceStrip{');expect(css).toContain('.lpSourceBreakdown[open]');expect(css).toContain('.lpDiagnostics[open]')});

 it('places the same contextual lead-origin disclosure on former landingpages',()=>{const affiliate=readFileSync(join(process.cwd(),'src/app/affiliates/AffiliateSmartlinks.tsx'),'utf8'),cache=readFileSync(join(process.cwd(),'src/lib/cached-smartlinks.ts'),'utf8');expect(affiliate).toContain('LandingpageSourceBreakdown');expect(affiliate).toContain('landingpageId={slot.id}');expect(cache).toContain('attachSmartlinkSourceBreakdowns')});
});
