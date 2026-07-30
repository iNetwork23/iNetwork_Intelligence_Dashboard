import React from'react';
import{renderToStaticMarkup}from'react-dom/server';
import{describe,expect,it,vi}from'vitest';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()})}));
import CampaignPicker from'@/app/smartlinks/CampaignPicker';
import{buildCampaignOptions}from'./campaign-picker';

const campaigns=buildCampaignOptions([
 {network_campaign_id:2,campaign_name:'Trafficpartner Smartlink',campaign_status:'active',network_tracking_domain_id:6450,redirects:[{offerId:8,offerUrlId:101,name:'LP Eins',status:'active',weight:50},{offerId:50,offerUrlId:102,name:'LP Zwei',status:'active',weight:50}]},
 {network_campaign_id:169,campaign_name:'Ohne Traffic',campaign_status:'inactive',network_tracking_domain_id:null,redirects:[]},
],[{campaignId:2,campaign:'Trafficpartner Smartlink',affiliateId:'436',affiliate:'Traffic Company',clicks30:1,sois30:0,revenue30:0,payout30:0,profit30:0,status:'active'}]);

describe('partner-aware campaign picker UI',()=>{
 it('renders partner filter, expanded campaign details and targeted links',()=>{
  const html=renderToStaticMarkup(<CampaignPicker campaigns={campaigns} initialPartner="436" initialQuery="traffic" initialOpen="2"/>);
  expect(html).toContain('Partner auswählen');
  expect(html).toContain('Traffic Company · Affiliate #436 · 1 Smartlink');
  expect(html).toContain('Smartlink, Campaign-ID, Partner oder Affiliate-ID suchen');
  expect(html).toContain('aria-expanded="true"');
  expect(html).toContain('Beobachtete Partnerzuordnung · letzte 30 Tage');
  expect(html).toContain('LP #101');
  expect(html).toContain('Offer #8');
  expect(html).toContain('50 %');
  expect(html).toContain('Tracking-Domain');
  expect(html).toContain('#6450');
  expect(html).toContain('Smartlink analysieren');
  expect(html).toContain('/smartlinks?campaign=2&amp;affiliate=436');
  expect(html).toContain('Partner im Affiliate Optimizer öffnen');
  expect(html).toContain('/affiliates?affiliate=436&amp;mode=smartlinks');
 });
 it('labels genuinely unassigned campaigns only when enrichment succeeded',()=>{
  const html=renderToStaticMarkup(<CampaignPicker campaigns={campaigns} initialOpen="169"/>);
  expect(html).toContain('Partner nicht zugeordnet');
  expect(html).toContain('Im 30-Tage-Beobachtungsfenster wurde kein Affiliate-Traffic gefunden');
 });
 it('does not propagate an affiliate context that was not observed for the campaign',()=>{
  const html=renderToStaticMarkup(<CampaignPicker campaigns={campaigns} affiliateId="999" initialOpen="2"/>);
  expect(html).toContain('href="/smartlinks?campaign=2&amp;affiliate=436&amp;open=2"');
  expect(html).not.toContain('affiliate=999');
 });
 it('shows a mapping error instead of claiming campaigns are unassigned',()=>{
  const html=renderToStaticMarkup(<CampaignPicker campaigns={campaigns} associationError="Partnerzuordnungen konnten nicht geladen werden." initialPartner="436" initialOpen="169"/>);
  expect(html).toContain('role="alert"');
  expect(html).toContain('Partnerzuordnungen konnten nicht geladen werden.');
  expect(html).toContain('Trafficpartner Smartlink');
  expect(html).toContain('Ohne Traffic');
  expect(html).not.toContain('<option value="unassigned">');
  expect(html).toContain('Zuordnung nicht verfügbar');
  expect(html).not.toContain('Partner nicht zugeordnet');
  expect(html).not.toContain('Im 30-Tage-Beobachtungsfenster wurde kein Affiliate-Traffic gefunden');
 });
});
