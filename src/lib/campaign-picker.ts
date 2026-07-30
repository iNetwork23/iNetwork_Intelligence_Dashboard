import type{CampaignAffiliateMapping}from'./affiliate-smartlinks';
import type{CampaignShape}from'./smartlink';

export type CampaignRedirectOption={offerId:number;offerUrlId:number;name:string;status:string;weight:number};
export type CampaignDirectoryView={network_campaign_id:number;campaign_name:string;campaign_status:string;network_tracking_domain_id:number|null;redirects:CampaignRedirectOption[]};
export type CampaignPartnerOption={id:string;name:string};
export type CampaignOption=CampaignDirectoryView&{partners:CampaignPartnerOption[];activeLandingpageCount:number};
export type PartnerFilterOption=CampaignPartnerOption&{campaignCount:number};

const partnerCompare=(a:CampaignPartnerOption,b:CampaignPartnerOption)=>a.name.localeCompare(b.name,'de',{sensitivity:'base'})||Number(a.id)-Number(b.id)||a.id.localeCompare(b.id);

export function campaignDirectoryViewFromSnapshot(directory:{network_campaign_id:number;campaign_name:string;campaign_status:string},shape:CampaignShape):CampaignDirectoryView{
 const entries=shape.relationship?.redirects?.entries??[],total=entries.reduce((sum,entry)=>sum+Math.max(0,Number(entry.routing_value)||0),0);
 return{
  ...directory,
  network_tracking_domain_id:Number.isSafeInteger(shape.network_tracking_domain_id)&&Number(shape.network_tracking_domain_id)>0?Number(shape.network_tracking_domain_id):null,
  redirects:entries.map(entry=>({
   offerId:entry.redirect_network_offer_id,
   offerUrlId:entry.redirect_network_offer_url_id,
   name:entry.relationship?.offer_url?.name||`LP #${entry.redirect_network_offer_url_id}`,
   status:entry.relationship?.offer_url?.url_status||'unknown',
   weight:total?Math.round(1000*Math.max(0,Number(entry.routing_value)||0)/total)/10:0,
  })),
 };
}

export function buildCampaignOptions(directory:CampaignDirectoryView[],mappings:CampaignAffiliateMapping[]):CampaignOption[]{
 const partnersByCampaign=new Map<number,Map<string,CampaignPartnerOption>>();
 for(const mapping of mappings){
  const bucket=partnersByCampaign.get(mapping.campaignId)??new Map<string,CampaignPartnerOption>();
  bucket.set(mapping.affiliateId,{id:mapping.affiliateId,name:mapping.affiliate});
  partnersByCampaign.set(mapping.campaignId,bucket);
 }
 return directory.map(campaign=>({
  ...campaign,
  partners:Array.from(partnersByCampaign.get(campaign.network_campaign_id)?.values()??[]).sort(partnerCompare),
  activeLandingpageCount:campaign.redirects.filter(redirect=>redirect.status.toLowerCase()==='active').length,
 }));
}

export function campaignPartnerOptions(campaigns:CampaignOption[]):PartnerFilterOption[]{
 const partners=new Map<string,PartnerFilterOption>();
 for(const campaign of campaigns)for(const partner of campaign.partners){
  const current=partners.get(partner.id);
  if(current)current.campaignCount++;
  else partners.set(partner.id,{...partner,campaignCount:1});
 }
 return Array.from(partners.values()).sort(partnerCompare);
}

export function filterCampaignOptions(campaigns:CampaignOption[],query:string,affiliateId='all'){
 const q=query.trim().toLowerCase();
 return campaigns.filter(campaign=>{
  const partnerMatch=affiliateId==='all'||(affiliateId==='unassigned'?campaign.partners.length===0:campaign.partners.some(partner=>partner.id===affiliateId));
  if(!partnerMatch)return false;
  if(!q)return true;
  const searchable=[String(campaign.network_campaign_id),campaign.campaign_name,campaign.campaign_status,...campaign.partners.flatMap(partner=>[partner.id,partner.name])];
  return searchable.some(value=>value.toLowerCase().includes(q));
 });
}
