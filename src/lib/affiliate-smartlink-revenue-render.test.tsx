import React from'react';
import{renderToStaticMarkup}from'react-dom/server';
import{describe,expect,it}from'vitest';
import{AttributionRow}from'../app/affiliates/AffiliateSmartlinks';
import type{RevenueOriginBreakdown}from'./smartlink-revenue-origin';

const origin:RevenueOriginBreakdown={soi:{count:57,revenue:0,payout:398},firstSale:{count:0,revenue:0,payout:0},rebill:{count:5,revenue:654.13,payout:0},coinSpend:{count:0,revenue:0,payout:0},unattributedRevenue:0,unattributedPayout:0};
describe('Campaign revenue origin rendering',()=>{
 it('states which event generated revenue and which event generated the payout',()=>{
  const html=renderToStaticMarkup(<AttributionRow label="Aktuelle Landingpages" detail="Test" metric={{firstSales:0,rebills:5,coinSpend:0,revenue:654.13,payout:398,profit:256.13}} origin={origin}/>);
  expect(html).toContain('Umsatzherkunft');
  expect(html).toContain('5 Rebills = 654,13 €');
  expect(html).toContain('Vergütungsherkunft');
  expect(html).toContain('57 SOIs = 398,00 €');
 });
});
