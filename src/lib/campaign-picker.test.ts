import{describe,expect,it}from'vitest';
import{buildCampaignOptions,campaignDirectoryViewFromSnapshot,campaignPartnerOptions,filterCampaignOptions}from'./campaign-picker';
import type{CampaignAffiliateMapping}from'./affiliate-smartlinks';

const directory=[
 {network_campaign_id:2,campaign_name:'Trafficpartner - POP - ALL',campaign_status:'active',network_tracking_domain_id:6450,redirects:[{offerId:8,offerUrlId:101,name:'LP Eins',status:'active',weight:50},{offerId:50,offerUrlId:102,name:'LP Zwei',status:'paused',weight:50}]},
 {network_campaign_id:146,campaign_name:'Global - TrafficCompany',campaign_status:'active',network_tracking_domain_id:4931,redirects:[{offerId:57,offerUrlId:201,name:'LP Drei',status:'paused',weight:100}]},
 {network_campaign_id:169,campaign_name:'WLX Offer 57',campaign_status:'inactive',network_tracking_domain_id:null,redirects:[]},
];
const mapping=(campaignId:number,affiliateId:string,affiliate:string):CampaignAffiliateMapping=>({campaignId,campaign:`C${campaignId}`,affiliateId,affiliate,clicks30:1,sois30:0,revenue30:0,payout30:0,profit30:0,status:'active'});
const mappings=[mapping(2,'32','Wheel of X'),mapping(2,'436','Traffic Company'),mapping(146,'77','Traffic Company'),mapping(146,'77','Traffic Company')];

describe('campaign snapshot picker projection',()=>{
 it('preserves tracking domain and current redirects with normalized weights',()=>{
  const view=campaignDirectoryViewFromSnapshot(
   {network_campaign_id:5,campaign_name:'Test',campaign_status:'active'},
   {network_campaign_id:5,campaign_name:'Test',campaign_status:'active',redirect_routing_type:'weight',network_tracking_domain_id:6450,relationship:{redirects:{entries:[
    {redirect_network_offer_id:8,redirect_network_offer_url_id:101,routing_value:1,relationship:{offer_url:{name:'LP Eins',url_status:'active'}}},
    {redirect_network_offer_id:50,redirect_network_offer_url_id:102,routing_value:3,relationship:{offer_url:{name:'LP Zwei',url_status:'paused'}}},
   ]}}},
  );
  expect(view).toEqual({network_campaign_id:5,campaign_name:'Test',campaign_status:'active',network_tracking_domain_id:6450,redirects:[
   {offerId:8,offerUrlId:101,name:'LP Eins',status:'active',weight:25},
   {offerId:50,offerUrlId:102,name:'LP Zwei',status:'paused',weight:75},
  ]});
 });
});

describe('partner-aware campaign picker',()=>{
 const campaigns=buildCampaignOptions(directory,mappings);
 it('ordnet alle beobachteten Partner positionsunabhängig zu und erhält Campaigns ohne Zuordnung',()=>{
  expect(campaigns.map(c=>[c.network_campaign_id,c.partners.map(p=>p.id)])).toEqual([[2,['436','32']],[146,['77']],[169,[]]]);
  expect(campaigns[0]).toMatchObject({activeLandingpageCount:1,network_tracking_domain_id:6450});
  expect(campaigns[2].partners).toEqual([]);
 });
 it('unterscheidet doppelte Partnernamen über die Affiliate-ID und zählt Campaigns',()=>{
  expect(campaignPartnerOptions(campaigns)).toEqual([
   {id:'77',name:'Traffic Company',campaignCount:1},
   {id:'436',name:'Traffic Company',campaignCount:1},
   {id:'32',name:'Wheel of X',campaignCount:1},
  ]);
 });
 it('sucht gleichzeitig nach Campaign, Partnername, Affiliate-ID und Status',()=>{
  expect(filterCampaignOptions(campaigns,'traffic company').map(c=>c.network_campaign_id)).toEqual([2,146]);
  expect(filterCampaignOptions(campaigns,'436').map(c=>c.network_campaign_id)).toEqual([2]);
  expect(filterCampaignOptions(campaigns,'169').map(c=>c.network_campaign_id)).toEqual([169]);
  expect(filterCampaignOptions(campaigns,'inactive').map(c=>c.network_campaign_id)).toEqual([169]);
 });
 it('kombiniert Partnerfilter und Suche und kann unzugeordnete Campaigns filtern',()=>{
  expect(filterCampaignOptions(campaigns,'traffic','436').map(c=>c.network_campaign_id)).toEqual([2]);
  expect(filterCampaignOptions(campaigns,'','unassigned').map(c=>c.network_campaign_id)).toEqual([169]);
  expect(filterCampaignOptions(campaigns,'','77').map(c=>c.network_campaign_id)).toEqual([146]);
 });
});
