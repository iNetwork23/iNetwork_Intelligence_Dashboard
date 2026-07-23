import{unstable_cache} from'next/cache';
import{loadAffiliateSmartlinkInsightsFromCache,loadCampaignAffiliateRowsFromCache,loadSmartlinkInsightFromCache}from'./cached-smartlinks';
import{aggregateCampaignAffiliates}from'./affiliate-smartlinks';
import{loadCampaignDirectoryFromCache}from'./campaign-snapshots';
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function getSmartlinkInsight(campaignId:number,bypass=false){if(bypass)return loadSmartlinkInsightFromCache(campaignId);return unstable_cache(()=>loadSmartlinkInsightFromCache(campaignId),['smartlink-intelligence-cache-v2',String(campaignId),day()],{revalidate:300,tags:[`smartlink-${campaignId}`]})();}
const allCampaigns=unstable_cache(()=>loadCampaignDirectoryFromCache(),['campaign-directory-supabase-v2'],{revalidate:300,tags:['campaign-directory']});
export async function getCampaignDirectory(){return allCampaigns()}
const campaignAffiliateRows=(range?:{from:string;to:string})=>unstable_cache(()=>loadCampaignAffiliateRowsFromCache(range),['campaign-affiliate-cache',range?.from||'30d',range?.to||day()],{revalidate:300,tags:['campaign-affiliate-directory']})();
export async function getCampaignAffiliateMappings(range?:{from:string;to:string}){const[rows,directory]=await Promise.all([campaignAffiliateRows(range),allCampaigns()]);return aggregateCampaignAffiliates(rows,directory)}
export async function getAffiliateSmartlinks(affiliateId:string,campaignIds:number[]){const ids=Array.from(new Set(campaignIds)).sort((a,b)=>a-b);return unstable_cache(()=>loadAffiliateSmartlinkInsightsFromCache(affiliateId,ids),['affiliate-smartlinks-cache-v2',affiliateId,ids.join(','),day()],{revalidate:300,tags:[`affiliate-smartlinks-${affiliateId}`]})()}
export async function findCampaigns(term:string){const q=term.trim().toLowerCase(),all=await allCampaigns(),exact=/^\d+$/.test(q)?Number(q):null;return all.filter(c=>exact!==null?c.network_campaign_id===exact:c.campaign_name.toLowerCase().includes(q)).slice(0,20)}
