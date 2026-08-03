import{unstable_cache} from'next/cache';
import{searchCampaigns}from'./everflow';
import{loadAffiliateSmartlinkInsightsFromCache,loadCampaignAffiliateRowsFromCache,loadSmartlinkInsightFromCache}from'./cached-smartlinks';
import{aggregateCampaignAffiliates}from'./affiliate-smartlinks';
const key=()=>process.env.EVERFLOW_API_KEY||'';
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function getSmartlinkInsight(campaignId:number,bypass=false){if(bypass)return loadSmartlinkInsightFromCache(campaignId,key());return unstable_cache(()=>loadSmartlinkInsightFromCache(campaignId,key()),['smartlink-intelligence-cache',String(campaignId),day()],{revalidate:60,tags:[`smartlink-${campaignId}`]})();}
const allCampaigns=unstable_cache(()=>searchCampaigns('',key()),['campaign-directory'],{revalidate:300,tags:['campaign-directory']});
export async function getCampaignDirectory(){return allCampaigns()}
const campaignAffiliateRows=unstable_cache(()=>loadCampaignAffiliateRowsFromCache(),['campaign-affiliate-cache',day()],{revalidate:300,tags:['campaign-affiliate-directory']});
export async function getCampaignAffiliateMappings(){const[rows,directory]=await Promise.all([campaignAffiliateRows(),allCampaigns()]);return aggregateCampaignAffiliates(rows,directory)}
export async function getAffiliateSmartlinks(affiliateId:string,campaignIds:number[]){const ids=Array.from(new Set(campaignIds)).sort((a,b)=>a-b);return unstable_cache(()=>loadAffiliateSmartlinkInsightsFromCache(affiliateId,ids,key()),['affiliate-smartlinks-cache',affiliateId,ids.join(','),day()],{revalidate:60,tags:[`affiliate-smartlinks-${affiliateId}`]})()}
export async function findCampaigns(term:string){const q=term.trim().toLowerCase(),all=await allCampaigns(),exact=/^\d+$/.test(q)?Number(q):null;return all.filter(c=>exact!==null?c.network_campaign_id===exact:c.campaign_name.toLowerCase().includes(q)).slice(0,20)}
