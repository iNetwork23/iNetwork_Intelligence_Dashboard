import{unstable_cache}from'next/cache';
import{loadAffiliateSmartlinkInsightsFromCache,loadCampaignAffiliateRowsFromCache,loadSmartlinkInsightFromCache}from'./cached-smartlinks';
import{aggregateCampaignAffiliates}from'./affiliate-smartlinks';
import{loadCampaignDirectoryFromCache}from'./campaign-snapshots';
import{assertScopesSupported,foreignScopeRequested,scopeFingerprint,type AccessMetadata}from'./rbac';
import{campaignAffiliateRowsForAccess,campaignDirectoryForAccess,partnerAffiliateForSmartlink}from'./service-scopes';

const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const allCampaigns=unstable_cache(()=>loadCampaignDirectoryFromCache(),['campaign-directory-supabase-v3'],{revalidate:300,tags:['campaign-directory']});

export function getSmartlinkInsight(campaignId:number,access:AccessMetadata,bypass=false,requestedAffiliateId?:string){
 if(requestedAffiliateId!==undefined&&!/^\d+$/.test(requestedAffiliateId))throw new Error('400 · Ungültige Affiliate-ID');
 if(foreignScopeRequested(access,{campaign:String(campaignId),affiliate:requestedAffiliateId}))throw new Error('403 · Fremde Campaign- oder Affiliate-ID');
 const scopedAffiliateId=partnerAffiliateForSmartlink(access),affiliateId=requestedAffiliateId||scopedAffiliateId,fingerprint=scopeFingerprint(access);
 const load=async()=>{
  if(!affiliateId)return loadSmartlinkInsightFromCache(campaignId);
  const insight=(await loadAffiliateSmartlinkInsightsFromCache(affiliateId,[campaignId],new Date()))[0];
  if(!insight)throw new Error(`Campaign #${campaignId}: keine freigegebenen Daten`);
  return insight;
 };
 if(bypass)return load();
 return unstable_cache(load,['smartlink-intelligence-cache-v4',String(campaignId),affiliateId||'unscoped',fingerprint,day()],{revalidate:300,tags:[`smartlink-${campaignId}`]})();
}

export async function getCampaignDirectory(access:AccessMetadata){
 const fingerprint=scopeFingerprint(access);
 return unstable_cache(async()=>campaignDirectoryForAccess(await allCampaigns(),access),['campaign-directory-scoped-v2',fingerprint],{revalidate:300,tags:['campaign-directory']})();
}

const campaignAffiliateRows=(range?:{from:string;to:string})=>unstable_cache(()=>loadCampaignAffiliateRowsFromCache(range),['campaign-affiliate-cache',range?.from||'30d',range?.to||day()],{revalidate:300,tags:['campaign-affiliate-directory']})();
export async function getCampaignAffiliateMappings(range:{from:string;to:string}|undefined,access:AccessMetadata){
 assertScopesSupported(access,['affiliate','campaign']);
 const fingerprint=scopeFingerprint(access);
 return unstable_cache(async()=>{
  const[raw,directory]=await Promise.all([campaignAffiliateRows(range),getCampaignDirectory(access)]);
  const rows=campaignAffiliateRowsForAccess(raw,access);
  return aggregateCampaignAffiliates(rows,directory);
 },['campaign-affiliate-directory-scoped-v2',range?.from||'30d',range?.to||day(),fingerprint],{revalidate:300,tags:['campaign-affiliate-directory']})();
}

export async function getAffiliateSmartlinks(affiliateId:string,campaignIds:number[],range:{from:string;to:string}|undefined,access:AccessMetadata){
 assertScopesSupported(access,['affiliate','campaign']);
 if(foreignScopeRequested(access,{affiliate:affiliateId}))throw new Error('403 · Fremde Affiliate-ID');
 const ids=Array.from(new Set(campaignIds)).sort((a,b)=>a-b);
 if(ids.some(id=>foreignScopeRequested(access,{campaign:String(id)})))throw new Error('403 · Fremde Campaign-ID');
 const selected=range||{from:'',to:''},fingerprint=scopeFingerprint(access);
 return unstable_cache(()=>loadAffiliateSmartlinkInsightsFromCache(affiliateId,ids,new Date(),range),['affiliate-smartlinks-cache-v5',affiliateId,ids.join(','),selected.from,selected.to,fingerprint,day()],{revalidate:300,tags:[`affiliate-smartlinks-${affiliateId}`]})();
}

export async function findCampaigns(term:string,access:AccessMetadata){
 const q=term.trim().toLowerCase(),all=await getCampaignDirectory(access),exact=/^\d+$/.test(q)?Number(q):null;
 return all.filter(c=>exact!==null?c.network_campaign_id===exact:c.campaign_name.toLowerCase().includes(q)).slice(0,20);
}
