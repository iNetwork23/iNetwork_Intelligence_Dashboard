import type {SlotRecommendation} from './smartlink';
import type {buildSmartlinkInsight} from './smartlink';
import type {SelectedRangeAttribution} from './smartlink-transparency';

export type SmartlinkInsight=ReturnType<typeof buildSmartlinkInsight> & {
  selectedRange?: {from:string;to:string;attribution:SelectedRangeAttribution};
};

const severityRank:Record<SlotRecommendation['severity'],number>={
  critical:0,
  warning:1,
  positive:2,
  neutral:3,
};

export function primarySmartlinkRecommendation(recommendations:readonly SlotRecommendation[]):SlotRecommendation|null{
  return recommendations.reduce<SlotRecommendation|null>((primary,current)=>
    primary===null||severityRank[current.severity]<severityRank[primary.severity]?current:primary
  ,null);
}

const safeAffiliateId=(value:string|undefined)=>/^\d+$/.test(value||'')?value:undefined;

function safeReturnHref(returnTo:string|undefined):string|undefined{
  if(returnTo?.startsWith('/affiliates')&&!returnTo.startsWith('//')){
    try{
      const url=new URL(returnTo,'https://dashboard.local');
      if(url.origin==='https://dashboard.local'&&url.pathname==='/affiliates')return `${url.pathname}${url.search}${url.hash}`;
    }catch{}
  }
  return undefined;
}

export function affiliateContextReturnHref(returnTo?:string,affiliateId?:string):string|undefined{
  const safeReturn=safeReturnHref(returnTo);
  if(safeReturn)return safeReturn;
  const affiliate=safeAffiliateId(affiliateId);
  return affiliate?`/affiliates?affiliate=${affiliate}&mode=smartlinks`:undefined;
}

export function affiliateReturnHref(returnTo?:string,affiliateId?:string):string{
  return affiliateContextReturnHref(returnTo,affiliateId)??'/affiliates';
}

export function smartlinkDeepDiveHref(input:{campaignId:number;affiliateId?:string;returnTo?:string}):string{
  const params=new URLSearchParams({campaign:String(input.campaignId)}),affiliate=safeAffiliateId(input.affiliateId);
  if(affiliate)params.set('affiliate',affiliate);
  if(input.returnTo)params.set('returnTo',affiliateReturnHref(input.returnTo,affiliate));
  return `/smartlinks?${params.toString()}`;
}

export function smartlinkRefreshHref(input:{campaignId:number;affiliateId?:string;returnTo?:string;timestamp:number}):string{
  const url=new URL(smartlinkDeepDiveHref(input),'https://dashboard.local');
  url.searchParams.set('refresh','1');
  url.searchParams.set('ts',String(input.timestamp));
  return `${url.pathname}${url.search}`;
}
