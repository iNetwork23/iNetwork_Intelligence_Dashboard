import React from 'react';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import PortfolioCopyButton from '../app/components/PortfolioCopyButton';
import {buildPortfolioCopyReport,type PortfolioCopyInput} from './portfolio-copy-report';

const input:PortfolioCopyInput={
 rangeLabel:'01.–31.08.2026',
 totals:{clicks:300,sois:30,cvr:10,firstSales:3,firstSaleRate:10,rebills:2,coinSpend:0,payout:90,revenue:140,profit:50,profitEpc:0.17},
 paths:[
  {key:'8|32|0|101',offerId:'8',offer:'Michverlieben',affiliateId:'32',affiliate:'LosPollos',campaignId:'0',campaign:'N/A',offerUrlId:'101',offerUrl:'LP A',trafficType:'Direkt',clicks:100,sois:10,cvr:10,firstSales:1,firstSaleRate:10,rebills:1,coinSpend:0,payout:30,revenue:50,profit:20,profitEpc:0.2},
  {key:'50|32|2|102',offerId:'50',offer:'Sex69',affiliateId:'32',affiliate:'LosPollos',campaignId:'2',campaign:'Smartlink',offerUrlId:'102',offerUrl:'LP B',trafficType:'Smartlink',clicks:150,sois:15,cvr:10,firstSales:2,firstSaleRate:13.33,rebills:1,coinSpend:0,payout:45,revenue:90,profit:45,profitEpc:0.3},
  {key:'57|44|0|103',offerId:'57',offer:'Singles69',affiliateId:'44',affiliate:'Partner B',campaignId:'0',campaign:'N/A',offerUrlId:'103',offerUrl:'LP C',trafficType:'Direkt',clicks:50,sois:5,cvr:10,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,payout:15,revenue:0,profit:-15,profitEpc:-0.3},
 ]
};

describe('copy-ready portfolio reports',()=>{
 it('builds a partner-safe company report with every active brand/offer and booked payouts',()=>{const text=buildPortfolioCopyReport(input,{scope:'affiliate',id:'32'});expect(text).toContain('LosPollos · 01.–31.08.2026');expect(text).toContain('Gesamt: 25 Leads (SOIs) · 75,00 € Payout');expect(text).toContain('Michverlieben (#8): 10 Leads · 30,00 € Payout');expect(text).toContain('Sex69 (#50): 15 Leads · 45,00 € Payout');expect(text).not.toContain('Singles69');for(const confidential of ['Umsatz','Revenue','Profit','First-Sales','Rebills','140,00 €','50,00 €'])expect(text).not.toContain(confidential)});
 it('omits brands with zero leads from a partner report even when they have financial events',()=>{const ghost={...input.paths[0],key:'99|32|0|199',offerId:'99',offer:'GhostBrand',sois:0,payout:999,revenue:999,profit:0};const text=buildPortfolioCopyReport({...input,paths:[...input.paths,ghost]},{scope:'affiliate',id:'32'});expect(text).not.toContain('GhostBrand');expect(text).not.toContain('999,00 €')});
 it('builds one brand/offer report broken down by company',()=>{const text=buildPortfolioCopyReport(input,{scope:'offer',id:'57'});expect(text).toContain('Singles69 (#57) · 01.–31.08.2026');expect(text).toContain('Partner B (#44): 5 Leads · 15,00 € Payout');expect(text).not.toContain('LosPollos')});
 it('builds a complete account report with company and brand/offer breakdowns',()=>{const text=buildPortfolioCopyReport(input,{scope:'total'});expect(text).toContain('Gesamtübersicht · 01.–31.08.2026');expect(text).toContain('30 Leads (SOIs) · 90,00 € Payout');expect(text).toContain('Nach Firma / Affiliate');expect(text).toContain('Nach Brand / Offer');expect(text).toContain('LosPollos (#32): 25 Leads · 75,00 € Payout');expect(text).toContain('Michverlieben (#8): 10 Leads · 30,00 € Payout')});
 it('renders an accessible one-click copy control with visible success feedback',()=>{const html=renderToStaticMarkup(<PortfolioCopyButton text="Report" label="Diese Firma kopieren"/>);expect(html).toContain('Diese Firma kopieren');expect(html).toContain('aria-live="polite"');expect(html).toContain('portfolioCopyButton idle')});
 it('labels company copy actions explicitly as partner reports',()=>{const page=readFileSync(join(process.cwd(),'src/app/page.tsx'),'utf8'),css=readFileSync(join(process.cwd(),'src/app/globals.css'),'utf8');for(const marker of ['Gesamtübersicht kopieren','Partnerbericht kopieren','Brand / Offer kopieren','Firmen / Affiliates','Brands / Offers'])expect(page).toContain(marker);expect(page).not.toContain("label={view==='affiliates'?'Firma kopieren'");expect(page).toContain("buildPortfolioCopyReport");expect(page).toContain("scope:'affiliate'");expect(page).toContain("scope:'offer'");for(const marker of ['.portfolioCopyBar','.portfolioCopyButton','.portfolioCopyControl'])expect(css).toContain(marker)});
});
