import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {SmartlinkRotationCards} from '../app/components/SmartlinkPresentation';
import type {SmartSlot} from './smartlink';

const metrics={clicks:120,sois:12,cvr:10,firstSales:2,firstSaleRate:16.67,rebills:1,coinSpend:7,revenue:50,payout:96,profit:-46,profitEpc:-0.383};
const metrics72={...metrics,revenue:72,payout:33,profit:39};
const slot:SmartSlot={id:'2673',name:'Test LP',offerId:'8',weight:33.3,status:'active',metrics24:metrics,metrics72,metrics14:metrics,hoursTo50Sois:12,sourceBreakdown:[{mode:'tracked',source:'CD_DE_ZERO',subSource:'45',clicks:120,sois:10,cvr:8.33,firstSales:1,rebills:1,coinSpend:4,revenue:25,payout:80,profit:-55,lastLeadDate:'2026-07-06',activityAsOf:'2026-07-27',activityCoverageComplete:true,activityLookbackDays:365},{mode:'api',source:'campaign-a',subSource:'creative-b',clicks:0,sois:2,cvr:null,firstSales:1,rebills:0,coinSpend:3,revenue:25,payout:16,profit:9,lastLeadDate:'2026-07-27',activityAsOf:'2026-07-27',activityCoverageComplete:true,activityLookbackDays:365}]};
const renderCards=(value:SmartSlot=slot)=>renderToStaticMarkup(<SmartlinkRotationCards slots={[value]} recommendations={[]} rotationLabel="Campaign-Speichertag als Referenz" windows={{traffic:'Heute',economics:'Letzte 3 Kalendertage',maturity:'Nach Referenztag',source:'Letzte 14 Kalendertage'}}/>);

describe('SmartlinkRotationCards visual hierarchy',()=>{
 it('keeps every existing KPI and makes each subsection visibly belong to its LP',()=>{const html=renderCards();expect(html).toContain('LP #2673 · Sales und Nachzahlungen');expect(html).toContain('LP #2673 · Woher kommen die Leads?');expect(html).toContain('LP #2673 · Kosten, Umsatz und Prognose');for(const text of['Profit im Reifefenster','Anmelderate (CVR)','SOIs','First-Sales','Anteil SOI → First-Sale','Rebills','Coin-Spend-Events','Profit je Klick','Umsatz · Letzte 3 Kalendertage','SOI-Vergütung · Letzte 3 Kalendertage','Geschätzte Zeit bis 50 SOIs'])expect(html).toContain(text);expect(html).toContain('72,00');expect(html).toContain('33,00')});

 it('renders recommendations as clearly labelled read-only status instead of an action button',()=>{const html=renderCards();expect(html).toContain('Empfehlung: Halten');expect(html).toContain('role="status"');expect(html).toContain('class="sharedStatusBadge neutral"');expect(html).not.toContain('<button type="button" class="sharedStatusBadge')});

 it('preserves all source dimensions, API labels, shares and the visible control total',()=>{const html=renderCards();expect(html).toContain('2 Source-Kombinationen');expect(html).toContain('12 von 12 SOIs nach Herkunft zugeordnet');expect(html).toContain('10 SOIs · 83,3 %');expect(html).toContain('2 SOIs · 16,7 %');for(const text of['Source','Sub1','ADV1','ADV2','n/a – clickless','Letzte 14 Kalendertage','Lead-Herkunft für LP #2673'])expect(html).toContain(text);for(const label of['Source CD_DE_ZERO kopieren','Sub1 45 kopieren','ADV1 campaign-a kopieren','ADV2 creative-b kopieren','Source + Sub1 kopieren','ADV1 + ADV2 kopieren'])expect(html).toContain(label)});

 it('prioritizes every source card while retaining all secondary metrics',()=>{const html=renderCards();expect(html).toContain('class="lpSourceCards"');for(const label of['Letzter Lead','Klicks','SOIs · Anteil','CVR','First-Sales','Rebills','Coin-Spend-Events','Umsatz','SOI-Vergütung','Profit'])expect(html).toContain(label);expect(html).toContain('06.07.2026');expect(html).toContain('Seit 21 Tagen keine neuen Leads');expect(html).toContain('Heute aktiv')});

 it('never claims inactivity when the Smartlink activity history is incomplete',()=>{const uncertain={...slot,sourceBreakdown:[{...slot.sourceBreakdown![0],activityCoverageComplete:false}]},html=renderCards(uncertain);expect(html).toContain('Status unbekannt');expect(html).toContain('Letzter bekannter Lead');expect(html).not.toContain('Seit 21 Tagen keine neuen Leads');expect(html).not.toContain('Vermutlich inaktiv')});

 it('uses the LP total as share denominator when source assignment is incomplete',()=>{const partial={...slot,sourceBreakdown:[slot.sourceBreakdown![0]]},html=renderCards(partial);expect(html).toContain('10 von 12 SOIs nach Herkunft zugeordnet');expect(html).toContain('10 SOIs · 83,3 %');expect(html).toContain('Abweichung prüfen');expect(html).not.toContain('10 SOIs · 100,0 %')});

 it('uses compact LP masters and one broad selected detail instead of nested wide cards',()=>{const css=readFileSync(join(process.cwd(),'src/app/globals.css'),'utf8'),shared=readFileSync(join(process.cwd(),'src/app/components/SmartlinkPresentation.tsx'),'utf8');for(const marker of['lpOverviewCard','lpDetailRegion','lpOverviewGrid','lpSourceCards'])expect(shared).toContain(marker);expect(shared).toContain('aria-pressed={selected}');expect(css).toContain('.lpOverviewGrid{');expect(css).toContain('.lpDetailRegion{');expect(css).toContain('.lpSourceCards{');expect(shared).not.toContain('<table className="lpSourceTable"')});

 it('uses distinct restrained accents for sales, source and economics sections',()=>{const css=readFileSync(join(process.cwd(),'src/app/globals.css'),'utf8');expect(css).toContain('--lp-sales:');expect(css).toContain('--lp-source:');expect(css).toContain('--lp-economics:');expect(css).toContain('.lpEvidenceStrip{');expect(css).toContain('.lpSourceBreakdown[open]');expect(css).toContain('.lpDiagnostics[open]')});

 it('places the same contextual lead-origin disclosure on former landingpages',()=>{const affiliate=readFileSync(join(process.cwd(),'src/app/affiliates/AffiliateSmartlinks.tsx'),'utf8'),cache=readFileSync(join(process.cwd(),'src/lib/cached-smartlinks.ts'),'utf8');expect(affiliate).toContain('LandingpageSourceBreakdown');expect(affiliate).toContain('landingpageId={slot.id}');expect(cache).toContain('attachSmartlinkSourceBreakdowns')});
});
