export type CampaignOption={network_campaign_id:number;campaign_name:string;campaign_status:string};
export function filterCampaignOptions(campaigns:CampaignOption[],query:string){const q=query.trim().toLowerCase();if(!q)return campaigns;return campaigns.filter(c=>String(c.network_campaign_id).includes(q)||c.campaign_name.toLowerCase().includes(q)||c.campaign_status.toLowerCase().includes(q))}
