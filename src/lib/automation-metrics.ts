import type {AutomationConfiguration} from './automation-config';
import type {AutomationVariantMetrics} from './automation-engine';

type Metrics={clicks:number;sois:number;cvr:number;firstSales:number;rebills:number;revenue:number;payout:number;profit:number};
type Slot={id:string;offerId:string;metrics14:Metrics};
type Insight={rotationStartEpoch:number|null;currentSlots:Slot[];legacySlots:Slot[]};
type Conversion={
 transaction_id:string;
 stableCustomerId?:string|null;
 conversion_unix_timestamp?:number;
 event:string;
 revenue?:number;
 relationship?:{affiliate?:{network_affiliate_id:number};offer?:{network_offer_id:number};offer_url?:{network_offer_url_id:number};campaign?:{network_campaign_id:number}};
};

function matchesSlot(row:Conversion,config:AutomationConfiguration,offerId:number,offerUrlId:number){
 const relationship=row.relationship;
 return relationship?.affiliate?.network_affiliate_id===config.affiliateId
  &&relationship.campaign?.network_campaign_id===config.campaignId
  &&relationship.offer?.network_offer_id===offerId
  &&relationship.offer_url?.network_offer_url_id===offerUrlId
  &&(row.event==='Sale'||row.event==='Rebill');
}

function payerConcentration(rows:Conversion[],config:AutomationConfiguration,offerId:number,offerUrlId:number,fromEpoch:number,toEpoch:number){
 const matching=rows.filter(row=>matchesSlot(row,config,offerId,offerUrlId));
 let identityUnavailable=false;
 const payers=new Map<string,number>();
 for(const row of matching){
  const timestamp=Number(row.conversion_unix_timestamp);
  if(!Number.isFinite(timestamp)){identityUnavailable=true;continue}
  if(timestamp<fromEpoch||timestamp>toEpoch)continue;
  const customerId=row.stableCustomerId?.trim();
  if(!customerId){identityUnavailable=true;continue}
  payers.set(customerId,(payers.get(customerId)||0)+Math.max(0,Number(row.revenue)||0));
 }
 const revenues=[...payers.values()].sort((a,b)=>b-a);
 const payerRevenue=revenues.reduce((sum,value)=>sum+value,0);
 if(identityUnavailable||payers.size===0||payerRevenue<=0)return{independentPayers:null,top1RevenueShare:null};
 return{independentPayers:payers.size,top1RevenueShare:revenues[0]/payerRevenue};
}

export function buildAutomationVariantMetrics(config:AutomationConfiguration,insight:Insight,conversions:Conversion[],now=new Date()):AutomationVariantMetrics[]{
 if(insight.rotationStartEpoch===null)return[];
 const rotationStartEpoch=Number(insight.rotationStartEpoch),nowEpoch=now.getTime()/1000;
 if(!Number.isFinite(rotationStartEpoch)||rotationStartEpoch>nowEpoch)return[];
 const slots=new Map(insight.currentSlots.map(slot=>[Number(slot.id),slot]));
 const ageHours=Math.max(0,(nowEpoch-rotationStartEpoch)/3600);
 return config.slots.flatMap(configSlot=>{
  const slot=slots.get(configSlot.offerUrlId);
  if(!slot||Number(slot.offerId)!==configSlot.offerId)return[];
  const concentration=payerConcentration(conversions,config,configSlot.offerId,configSlot.offerUrlId,rotationStartEpoch,nowEpoch);
  return[{
   offerUrlId:configSlot.offerUrlId,
   clicks:slot.metrics14.clicks,
   sois:slot.metrics14.sois,
   cvr:slot.metrics14.cvr/100,
   firstSales:slot.metrics14.firstSales,
   rebills:slot.metrics14.rebills,
   revenue:slot.metrics14.revenue,
   payout:slot.metrics14.payout,
   profit:slot.metrics14.profit,
   ...concentration,
   ageHours,
   mature:ageHours>=config.thresholds.maturityHours,
  }];
 });
}
