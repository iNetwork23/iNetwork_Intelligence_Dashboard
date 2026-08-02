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

const optimizerRangeStateKeys=['period','from','to','calendarYear','calendarMonth','sourcePeriod','sourceFrom','sourceTo','sourceSort','sourceOpen'] as const;

export function affiliateOptimizerCurrentHref(input:{affiliateId?:string;rangeParams?:string;query?:string;partner?:string;open?:string}):string{
  const params=new URLSearchParams(),range=new URLSearchParams(input.rangeParams||''),affiliate=safeAffiliateId(input.affiliateId);
  for(const key of optimizerRangeStateKeys){const value=range.get(key);if(value)params.set(key,value.slice(0,4096))}
  if(affiliate)params.set('affiliate',affiliate);
  params.set('mode','smartlinks');
  const query=(input.query||'').trim().slice(0,200);
  if(query)params.set('q',query);
  if(input.partner&&(input.partner==='unassigned'||/^\d+$/.test(input.partner)))params.set('partner',input.partner);
  if(/^\d+$/.test(input.open||''))params.set('open',input.open!);
  return `/affiliates?${params.toString()}`;
}

export function affiliateCampaignHref(input:{campaignId:number;affiliateId?:string;currentHref?:string}):string{
  const affiliate=safeAffiliateId(input.affiliateId),params=new URLSearchParams();
  if(input.currentHref){
    try{
      const current=new URL(input.currentHref,'https://dashboard.local');
      if(current.pathname==='/affiliates')current.searchParams.forEach((value,key)=>params.set(key,value));
    }catch{}
  }
  if(affiliate)params.set('affiliate',affiliate);else params.delete('affiliate');
  params.set('mode','smartlinks');
  params.set('campaign',String(input.campaignId));
  params.delete('offer');
  return `/affiliates?${params.toString()}#campaign-${input.campaignId}`;
}

export function affiliateCampaignStateHref(input:{campaignId:number;affiliateId?:string;currentHref?:string;query?:string;partner?:string;open?:number|null}):string{
  const url=new URL(affiliateCampaignHref(input),'https://dashboard.local'),query=(input.query||'').trim().slice(0,200),partner=input.partner;
  if(query)url.searchParams.set('q',query);else url.searchParams.delete('q');
  if(partner&&(partner==='unassigned'||/^\d+$/.test(partner)))url.searchParams.set('partner',partner);else url.searchParams.delete('partner');
  if(input.open&&Number.isSafeInteger(input.open))url.searchParams.set('open',String(input.open));else url.searchParams.delete('open');
  return`${url.pathname}${url.search}${url.hash}`;
}

export function affiliateCampaignRefreshHref(input:{campaignId:number;affiliateId:string;currentHref:string;timestamp:number}):string{
  const url=new URL(affiliateCampaignHref(input),'https://dashboard.local');
  url.searchParams.set('refresh','1');
  url.searchParams.set('ts',String(Math.max(0,Math.trunc(input.timestamp))));
  return`${url.pathname}${url.search}${url.hash}`;
}

const legacyStateKeys=['period','from','to','calendarYear','calendarMonth','sourcePeriod','sourceFrom','sourceTo','sourceSort','sourceOpen','q','partner','open'] as const;

export function legacySmartlinkRedirectHref(input:{campaignId?:number|null;affiliateId?:string;returnTo?:string;query?:Record<string,string|undefined>}):string{
  const affiliate=safeAffiliateId(input.affiliateId),base=new URL(affiliateReturnHref(input.returnTo,affiliate),'https://dashboard.local');
  for(const key of legacyStateKeys){const value=input.query?.[key];if(value)base.searchParams.set(key,value)}
  if(input.query?.refresh==='1')base.searchParams.set('refresh','1');
  if(/^\d{1,16}$/.test(input.query?.ts||''))base.searchParams.set('ts',input.query!.ts!);
  if(input.campaignId&&Number.isSafeInteger(input.campaignId))return affiliateCampaignHref({campaignId:input.campaignId,affiliateId:affiliate,currentHref:`${base.pathname}${base.search}${base.hash}`});
  if(affiliate)base.searchParams.set('affiliate',affiliate);else base.searchParams.delete('affiliate');
  base.searchParams.set('mode','smartlinks');
  return `${base.pathname}${base.search}`;
}

export function contextlessSmartlinkFavoriteHref(input:{campaignId:number;currentHref?:string}):string{
  const target=new URL('/smartlinks','https://dashboard.local');
  if(input.currentHref){try{const current=new URL(input.currentHref,'https://dashboard.local');if(current.origin==='https://dashboard.local'&&current.pathname==='/affiliates')for(const key of legacyStateKeys){if(key==='partner')continue;const value=current.searchParams.get(key);if(value)target.searchParams.set(key,value)}}catch{}}
  target.searchParams.set('campaign',String(input.campaignId));
  return`${target.pathname}${target.search}`;
}

export function automationCampaignHref(input:{campaignId:number;affiliateId:string;slotId?:string}):string{
  const params=new URLSearchParams({affiliate:safeAffiliateId(input.affiliateId)||'',campaign:String(input.campaignId)});
  if(input.slotId)params.set('slot',input.slotId);
  params.set('intent','replace');
  return `/automation?${params.toString()}`;
}

export function smartlinkRefreshHref(input:{campaignId:number;affiliateId?:string;returnTo?:string;timestamp:number}):string{
  const url=new URL(smartlinkDeepDiveHref(input),'https://dashboard.local');
  url.searchParams.set('refresh','1');
  url.searchParams.set('ts',String(input.timestamp));
  return `${url.pathname}${url.search}`;
}
