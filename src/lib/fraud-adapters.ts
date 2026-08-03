import {classifyTrafficPath,normalizeFraudSource,type FraudConversionInput,type FraudMetricInput,type FraudTrafficMode} from './fraud-control';

export type FraudReportRow={columns:Array<{column_type:string;id:string;label:string}>;reporting:Record<string,number>};
const dim=(row:FraudReportRow,type:string)=>row.columns.find(column=>column.column_type===type)||{id:'',label:''};
const value=(row:FraudReportRow,key:string)=>Number(row.reporting[key]||0);

export function fraudMetricFromReportRow(row:FraudReportRow):FraudMetricInput{
  const campaign=dim(row,'campaign'),offer=dim(row,'offer'),mode=dim(row,'traffic_mode').id,sourceId=dim(row,'source_id').id,adv1=dim(row,'adv1').id,adv2=dim(row,'adv2').id;
  const explicitMode=mode==='api'?'api':mode==='unknown'?'unknown':mode==='tracked'?(campaign.id&&campaign.id!=='0'?'tracked_smartlink':'tracked_direct'):null;
  const trafficMode=classifyTrafficPath({campaignId:campaign.id,clicks:value(row,'total_click'),offerName:offer.label,offerUrlId:dim(row,'offer_url').id,sourceId,adv1,adv2,explicitMode});
  const source=normalizeFraudSource({trafficMode,sourceId,sub1:dim(row,'sub1').id,sub2:dim(row,'sub2').id,sub3:dim(row,'sub3').id,sub4:dim(row,'sub4').id,sub5:dim(row,'sub5').id,adv1,adv2});
  return{date:dim(row,'date').id,affiliateId:dim(row,'affiliate').id,affiliateName:dim(row,'affiliate').label,offerId:offer.id,offerName:offer.label,campaignId:campaign.id||'0',campaignName:campaign.label||'Direct',offerUrlId:dim(row,'offer_url').id||'0',offerUrlName:dim(row,'offer_url').label||'N/A',trafficMode,...source,clicks:value(row,'total_click'),sois:value(row,'cv'),firstSales:value(row,'first_sales'),rebills:value(row,'rebills'),coinEvents:value(row,'coin_spend'),payout:value(row,'payout'),revenue:value(row,'revenue')};
}

type CacheRecord={id:string;type:string;converted_at:string;click_at:string|null;affiliate_id:string|null;affiliate_name:string|null;offer_id:string|null;offer_name:string|null;campaign_id:string|null;campaign_name:string|null;offer_url_id:string|null;offer_url_name:string|null;traffic_mode:string;source_id:string|null;sub_source:string|null;source_dimension?:string;sub_source_dimension?:string;lead_id:string;status:string|null;is_scrub:boolean;error_code:string|null;payout:number|string;revenue:number|string;raw?:unknown};
const modes=new Set<FraudTrafficMode>(['tracked_smartlink','tracked_direct','clickless_api','unknown']);
const types=new Set<FraudConversionInput['type']>(['soi','coin_spend','first_sale','rebill']);
export function fraudConversionFromCacheRecord(row:CacheRecord):FraudConversionInput{
  if(!types.has(row.type as FraudConversionInput['type']))throw new Error(`Unbekannter Fraud-Conversiontyp: ${row.type}`);
  const trafficMode=modes.has(row.traffic_mode as FraudTrafficMode)?row.traffic_mode as FraudTrafficMode:'unknown';
  return{id:row.id,type:row.type as FraudConversionInput['type'],convertedAt:row.converted_at,clickAt:row.click_at,affiliateId:row.affiliate_id||'0',affiliateName:row.affiliate_name||'N/A',offerId:row.offer_id||'0',offerName:row.offer_name||'N/A',campaignId:row.campaign_id||'0',campaignName:row.campaign_name||'Direct',offerUrlId:row.offer_url_id||'0',offerUrlName:row.offer_url_name||'N/A',trafficMode,source:row.source_id||'Nicht übermittelt',subSource:row.sub_source||'Nicht übermittelt',sourceDimension:(row.source_dimension||'unknown') as FraudConversionInput['sourceDimension'],subSourceDimension:(row.sub_source_dimension||'unknown') as FraudConversionInput['subSourceDimension'],leadId:row.lead_id,status:row.status,isScrub:Boolean(row.is_scrub),errorCode:row.error_code,payout:Number(row.payout||0),revenue:Number(row.revenue||0)};
}
