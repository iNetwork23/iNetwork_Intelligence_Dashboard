import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/session';
import {can,foreignScopeRequested} from '@/lib/rbac';
import {getCampaignAffiliateMappings} from '@/lib/smartlink-service';
import {legacySmartlinkRedirectHref} from '@/lib/optimization-workflow';
import LegacySmartlinksPage from './LegacySmartlinksPage';

export const dynamic='force-dynamic';

export default async function LegacySmartlinksRedirect({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await currentUser();
  if(!user)redirect('/login');
  if(!can(user.access,'smartlinks.view')||!can(user.access,'finance.view'))redirect('/affiliates');
  const query=await searchParams;
  const campaignId=/^\d+$/.test(query.campaign||'')?Number(query.campaign):null;
  const requestedAffiliate=/^\d+$/.test(query.affiliate||'')?query.affiliate:/^\d+$/.test(query.partner||'')?query.partner:undefined;
  if(foreignScopeRequested(user.access,{campaign:query.campaign,affiliate:requestedAffiliate}))redirect('/affiliates');
  let affiliateId=requestedAffiliate,fallbackToLegacy=false;
  if(campaignId&&!affiliateId){
    try{
      const matches=(await getCampaignAffiliateMappings(undefined,user.access)).filter(mapping=>mapping.campaignId===campaignId);
      if(matches.length!==1)fallbackToLegacy=true;
      else affiliateId=matches[0].affiliateId;
    }catch(cause){
      console.error('Legacy Smartlink redirect mapping failed',cause);
      fallbackToLegacy=true;
    }
  }
  if(fallbackToLegacy)return <LegacySmartlinksPage searchParams={Promise.resolve(query)} />;
  redirect(legacySmartlinkRedirectHref({campaignId,affiliateId,returnTo:query.returnTo,query}));
}
