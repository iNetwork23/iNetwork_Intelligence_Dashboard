import {unstable_cache} from 'next/cache';
import {loadSmartlinkInsight,searchCampaigns} from './everflow';
const key=()=>process.env.EVERFLOW_API_KEY||'';
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function getSmartlinkInsight(campaignId:number,bypass=false){if(bypass)return loadSmartlinkInsight(campaignId,key());return unstable_cache(()=>loadSmartlinkInsight(campaignId,key()),['smartlink-intelligence',String(campaignId),day()],{revalidate:60,tags:[`smartlink-${campaignId}`]})();}
const allCampaigns=unstable_cache(()=>searchCampaigns('',key()),['campaign-directory'],{revalidate:300,tags:['campaign-directory']});
export async function findCampaigns(term:string){const q=term.trim().toLowerCase(),all=await allCampaigns(),exact=/^\d+$/.test(q)?Number(q):null;return all.filter(c=>exact!==null?c.network_campaign_id===exact:c.campaign_name.toLowerCase().includes(q)).slice(0,20)}
