import'server-only';
import{unstable_cache}from'next/cache';
import{getSupabaseAdmin}from'./supabase';
import type{AccessMetadata}from'./rbac';
import type{RebillEvent}from'./rebill-concentration';
import{mapStoredRebillEvent,rebillEventsForAccess,rebillQueryEnvelope,type StoredRebillEvent}from'./rebill-concentration-query';
async function loadAffiliateRebillEvents(affiliateId:string,range:{from:string;to:string}){if(!/^\d+$/.test(affiliateId))throw new Error('Ungültige Affiliate-ID');const envelope=rebillQueryEnvelope(range),events:RebillEvent[]=[];for(let start=0;;start+=1000){const{data,error}=await getSupabaseAdmin().from('conversions').select('type,lead_id,converted_at,campaign_id,offer_id,offer_url_id,status').eq('affiliate_id',affiliateId).eq('type','rebill').gte('converted_at',envelope.from).lt('converted_at',envelope.toExclusive).or('status.eq.approved,status.is.null').order('converted_at').order('id').range(start,start+999);if(error)throw new Error(`Supabase Rebill-Verteilung: ${error.message}`);const batch=((data||[])as StoredRebillEvent[]).map(mapStoredRebillEvent).filter((row):row is RebillEvent=>row!==null);events.push(...batch);if((data||[]).length<1000)break}return events}
const cachedAffiliateRebillEvents=(affiliateId:string,range:{from:string;to:string})=>unstable_cache(()=>loadAffiliateRebillEvents(affiliateId,range),['affiliate-rebill-events-v1',affiliateId,range.from,range.to],{revalidate:300,tags:[`affiliate-rebills-${affiliateId}`]})();
export async function getAffiliateRebillEvents(affiliateId:string,range:{from:string;to:string},access:AccessMetadata){return rebillEventsForAccess(await cachedAffiliateRebillEvents(affiliateId,range),affiliateId,access)}
