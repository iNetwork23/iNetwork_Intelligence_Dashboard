import{hasStableCustomerIdentity}from'./customer-identity';
import{berlinRangeUtcBounds}from'./reporting-day';

export type FraudTrafficMode='tracked_smartlink'|'tracked_direct'|'clickless_api'|'unknown';

type TrafficPathInput={
  campaignId?:string|null;
  clicks?:number;
  offerName?:string|null;
  offerUrlId?:string|null;
  adv1?:string|null;
  adv2?:string|null;
  sourceId?:string|null;
  explicitMode?:string|null;
};

const present=(value:unknown)=>typeof value==='string'&&value.trim()!==''&&value!=='0'&&value.toLowerCase()!=='n/a';

export function classifyTrafficPath(input:TrafficPathInput):FraudTrafficMode{
  const apiSignal=present(input.adv1)||present(input.adv2),trackedSignal=present(input.campaignId)||(input.clicks||0)>0;
  if(input.explicitMode==='unknown')return'unknown';
  if(input.explicitMode==='clickless_api'||input.explicitMode==='api')return present(input.campaignId)?'unknown':'clickless_api';
  if(input.explicitMode==='tracked_smartlink')return apiSignal?'unknown':'tracked_smartlink';
  if(input.explicitMode==='tracked_direct')return apiSignal?'unknown':'tracked_direct';
  if(apiSignal&&trackedSignal)return'unknown';
  if(apiSignal)return'clickless_api';
  if(present(input.campaignId))return'tracked_smartlink';
  if((input.clicks||0)>0||present(input.offerUrlId)||present(input.sourceId))return'tracked_direct';
  return'unknown';
}

type SourceInput={
  trafficMode:FraudTrafficMode;
  sourceId?:string|null;
  sub1?:string|null;
  sub2?:string|null;
  sub3?:string|null;
  sub4?:string|null;
  sub5?:string|null;
  adv1?:string|null;
  adv2?:string|null;
};

export type FraudSourceIdentity={source:string;subSource:string;sourceDimension:'source_id'|'adv1'|'unknown';subSourceDimension:'sub1'|'sub2'|'sub3'|'sub4'|'sub5'|'adv2'|'unknown'};

export function normalizeFraudSource(input:SourceInput):FraudSourceIdentity{
  if(input.trafficMode==='clickless_api')return{source:present(input.adv1)?input.adv1!.trim():'Nicht übermittelt',subSource:present(input.adv2)?input.adv2!.trim():'Nicht übermittelt',sourceDimension:'adv1',subSourceDimension:'adv2'};
  if(input.trafficMode==='tracked_smartlink'||input.trafficMode==='tracked_direct'){
    const subs=[['sub5',input.sub5],['sub4',input.sub4],['sub3',input.sub3],['sub2',input.sub2],['sub1',input.sub1]]as const;
    const deepest=subs.find(([,value])=>present(value));
    return{source:present(input.sourceId)?input.sourceId!.trim():'Nicht übermittelt',subSource:deepest?deepest[1]!.trim():'Nicht übermittelt',sourceDimension:'source_id',subSourceDimension:deepest?.[0]||'unknown'};
  }
  return{source:'Nicht bestimmbar',subSource:'Nicht bestimmbar',sourceDimension:'unknown',subSourceDimension:'unknown'};
}

export type FraudMetricInput={
  date:string;affiliateId:string;affiliateName:string;offerId:string;offerName:string;campaignId:string;campaignName:string;
  offerUrlId:string;offerUrlName:string;trafficMode:FraudTrafficMode;source:string;subSource:string;sourceDimension?:FraudSourceIdentity['sourceDimension'];subSourceDimension?:FraudSourceIdentity['subSourceDimension'];
  clicks:number;sois:number;firstSales:number;rebills:number;coinEvents:number;payout:number;revenue:number;
};

export type FraudConversionInput={
  id:string;type:'soi'|'coin_spend'|'first_sale'|'rebill';convertedAt:string;clickAt:string|null;
  affiliateId:string;affiliateName:string;offerId:string;offerName:string;campaignId:string;campaignName:string;
  offerUrlId:string;offerUrlName:string;trafficMode:FraudTrafficMode;source:string;subSource:string;sourceDimension?:FraudSourceIdentity['sourceDimension'];subSourceDimension?:FraudSourceIdentity['subSourceDimension'];leadId:string;
  status:string|null;isScrub:boolean;errorCode:string|null;payout:number;revenue:number;
};

export function conversionsForFraudRange(conversions:FraudConversionInput[],range:{from:string;to:string}){
  const bounds=berlinRangeUtcBounds(range.from,range.to),from=Date.parse(bounds.from),through=Date.parse(bounds.toExclusive);
  return conversions.filter(row=>{const at=Date.parse(row.convertedAt);return at>=from&&at<through});
}

export type FraudRiskLevel='unauffällig'|'beobachten'|'verdächtig'|'hohes_risiko'|'unbekannt';
export type FraudSourceEvaluation={
  key:string;affiliateId:string;affiliateName:string;offerId:string;offerName:string;campaignId:string;campaignName:string;
  offerUrlId:string;offerUrlName:string;trafficMode:FraudTrafficMode;source:string;subSource:string;sourceDimension:FraudSourceIdentity['sourceDimension'];subSourceDimension:FraudSourceIdentity['subSourceDimension'];
  metrics:{clicks:number;sois:number;firstSales:number;rebills:number;coinEvents:number;payout:number;revenue:number;profit:number};
  cohort:{mode:'user_joined'|'aggregate_only'|'unavailable';matureLeads:number;coinUsers:number;saleUsers:number;rebillUsers:number;coinEvents:number};
  baseline:number|null;coinZeroSaleProbability:number|null;timing:{eligible:boolean;total:number;under15Seconds:number;under15Rate:number|null};
  rebillConcentration:{status:'available'|'unknown';customers:number|null;events:number|null;top1Share:number|null;top2Share:number|null};
  joinCoverage:{coinSpend:number|null;firstSale:number|null;rebill:number|null;threshold:number};
  qualityScore:number;fraudScore:number;riskLevel:FraudRiskLevel;reasons:string[];dataWarnings:string[];
};

const evaluationKey=(value:{affiliateId:string;offerId:string;campaignId:string;offerUrlId:string;trafficMode:FraudTrafficMode;source:string;subSource:string;sourceDimension?:FraudSourceIdentity['sourceDimension'];subSourceDimension?:FraudSourceIdentity['subSourceDimension']})=>[value.affiliateId,value.offerId,value.campaignId,value.offerUrlId,value.trafficMode,value.sourceDimension||'unknown',value.source,value.subSourceDimension||'unknown',value.subSource].join('\u0000');
const coverageKey=(value:{affiliateId:string;offerId:string;trafficMode:FraudTrafficMode;source:string;subSource:string;sourceDimension?:FraudSourceIdentity['sourceDimension'];subSourceDimension?:FraudSourceIdentity['subSourceDimension']})=>[value.affiliateId,value.offerId,value.trafficMode,value.sourceDimension||'unknown',value.source,value.subSourceDimension||'unknown',value.subSource].join('\u0000');
const approved=(row:FraudConversionInput)=>!row.isScrub&&(!row.status||row.status.toLowerCase()==='approved');
const identityAvailable=(row:FraudConversionInput)=>hasStableCustomerIdentity(row.leadId);
const level=(score:number):FraudRiskLevel=>score>=70?'hohes_risiko':score>=50?'verdächtig':score>=25?'beobachten':'unauffällig';

export function deriveCoinBaselines(conversions:FraudConversionInput[],now=new Date(),maturityHours=336,minCoinUsers=30):Record<string,number>{
  const clean=conversions.filter(row=>approved(row)&&identityAvailable(row)),eventsByLead=new Map<string,FraudConversionInput[]>();
  for(const row of clean){const key=`${row.affiliateId}\u0000${row.offerId}\u0000${row.leadId}`,events=eventsByLead.get(key)||[];events.push(row);eventsByLead.set(key,events)}
  const groups=new Map<string,{coin:Set<string>;sale:Set<string>}>(),maturityMs=maturityHours*3_600_000;
  for(const registration of clean){
    if(registration.type!=='soi'||registration.trafficMode==='clickless_api'||now.getTime()-Date.parse(registration.convertedAt)<maturityMs)continue;
    const events=eventsByLead.get(`${registration.affiliateId}\u0000${registration.offerId}\u0000${registration.leadId}`)||[],registeredAt=Date.parse(registration.convertedAt),hasCoin=events.some(event=>event.type==='coin_spend'&&Date.parse(event.convertedAt)>=registeredAt),hasSale=events.some(event=>event.type==='first_sale'&&Date.parse(event.convertedAt)>=registeredAt);
    if(!hasCoin)continue;
    for(const key of[`${registration.affiliateId}|${registration.offerId}|${registration.trafficMode}`,`${registration.offerId}|${registration.trafficMode}`,registration.offerId]){const group=groups.get(key)||{coin:new Set<string>(),sale:new Set<string>()},identity=`${registration.affiliateId}\u0000${registration.offerId}\u0000${registration.leadId}`;group.coin.add(identity);if(hasSale)group.sale.add(identity);groups.set(key,group)}
  }
  const result:Record<string,number>={};for(const[key,group]of groups)if(group.coin.size>=minCoinUsers)result[key]=group.sale.size/group.coin.size;return result;
}

export function evaluateFraudSources(input:{metrics:FraudMetricInput[];conversions:FraudConversionInput[];now?:Date;maturityHours?:number;baselines:Record<string,number>}):FraudSourceEvaluation[]{
  const grouped=new Map<string,{seed:FraudMetricInput;rows:FraudMetricInput[]}>();
  for(const row of input.metrics){const key=evaluationKey(row),current=grouped.get(key)||{seed:row,rows:[]};current.rows.push(row);grouped.set(key,current)}
  const now=(input.now||new Date()).getTime(),maturityMs=(input.maturityHours??336)*3_600_000;
  const eventsByLead=new Map<string,FraudConversionInput[]>();
  for(const row of input.conversions.filter(row=>approved(row)&&identityAvailable(row))){const key=`${row.affiliateId}\u0000${row.offerId}\u0000${row.leadId}`,events=eventsByLead.get(key)||[];events.push(row);eventsByLead.set(key,events)}
  const canonicalRegistrations=new Map<string,FraudConversionInput>();for(const row of input.conversions.filter(row=>approved(row)&&identityAvailable(row)&&row.type==='soi')){const identity=`${row.affiliateId}\u0000${row.offerId}\u0000${row.leadId}`,current=canonicalRegistrations.get(identity);if(!current||Date.parse(row.convertedAt)<Date.parse(current.convertedAt)||row.convertedAt===current.convertedAt&&row.id<current.id)canonicalRegistrations.set(identity,row)}
  const results:FraudSourceEvaluation[]=[];
  for(const[key,{seed,rows}]of grouped){
    const totals=rows.reduce((sum,row)=>({clicks:sum.clicks+row.clicks,sois:sum.sois+row.sois,firstSales:sum.firstSales+row.firstSales,rebills:sum.rebills+row.rebills,coinEvents:sum.coinEvents+row.coinEvents,payout:sum.payout+row.payout,revenue:sum.revenue+row.revenue}),{clicks:0,sois:0,firstSales:0,rebills:0,coinEvents:0,payout:0,revenue:0});
    const registrations=[...canonicalRegistrations.values()].filter(row=>evaluationKey(row)===key),matureRegistrations=registrations.filter(row=>now-Date.parse(row.convertedAt)>=maturityMs);
    const eventTotals={coin_spend:totals.coinEvents,first_sale:totals.firstSales,rebill:totals.rebills},joinedTotals={coin_spend:0,first_sale:0,rebill:0};
    const coinUsers=new Set<string>(),saleUsers=new Set<string>(),rebillUsers=new Set<string>(),rebillCounts=new Map<string,number>();let joinedCoinEvents=0;
    for(const registration of matureRegistrations){const events=eventsByLead.get(`${registration.affiliateId}\u0000${registration.offerId}\u0000${registration.leadId}`)||[];for(const event of events){if(Date.parse(event.convertedAt)<Date.parse(registration.convertedAt)||event.type==='soi'||coverageKey(event)!==coverageKey(seed))continue;joinedTotals[event.type]++;if(event.type==='coin_spend'){coinUsers.add(registration.leadId);joinedCoinEvents++}else if(event.type==='first_sale')saleUsers.add(registration.leadId);else if(event.type==='rebill'){rebillUsers.add(registration.leadId);rebillCounts.set(registration.leadId,(rebillCounts.get(registration.leadId)||0)+1)}}}
    const coverageRate=(type:keyof typeof eventTotals)=>eventTotals[type]?Math.min(1,joinedTotals[type]/eventTotals[type]):null,coinCoverage=coverageRate('coin_spend'),saleCoverage=coverageRate('first_sale'),rebillCoverage=coverageRate('rebill'),coverageThreshold=.8,identityReliable=(type:keyof typeof eventTotals,rate:number|null)=>!(eventTotals[type]===0&&joinedTotals[type]>0)&&(rate===null||rate>=coverageThreshold);
    const aggregateOnly=seed.trafficMode==='clickless_api',unknownPath=seed.trafficMode==='unknown',identityBlocked=unknownPath||(aggregateOnly&&!registrations.length),cohortReliable=identityReliable('coin_spend',coinCoverage)&&identityReliable('first_sale',saleCoverage),cohortMode=unknownPath?'unavailable':registrations.length&&cohortReliable?'user_joined':aggregateOnly?'aggregate_only':'unavailable';
    const specificBaseline=input.baselines[`${seed.affiliateId}|${seed.offerId}|${seed.trafficMode}`],offerModeBaseline=input.baselines[`${seed.offerId}|${seed.trafficMode}`],offerBaseline=input.baselines[seed.offerId];
    const baseline=Number.isFinite(specificBaseline)?specificBaseline:Number.isFinite(offerModeBaseline)?offerModeBaseline:Number.isFinite(offerBaseline)?offerBaseline:null;
    const zeroProbability=!identityBlocked&&cohortReliable&&matureRegistrations.length>0&&coinUsers.size>0&&saleUsers.size===0&&baseline!==null?Math.pow(1-baseline,coinUsers.size):null;
    const timingRows=seed.trafficMode==='tracked_direct'||seed.trafficMode==='tracked_smartlink'?registrations.filter(row=>row.clickAt&&Date.parse(row.convertedAt)>=Date.parse(row.clickAt)):[];
    const under15=timingRows.filter(row=>Date.parse(row.convertedAt)-Date.parse(row.clickAt!)<=15_000).length,timingRate=timingRows.length?under15/timingRows.length:null;
    let fraudScore=0;const reasons:string[]=[],dataWarnings:string[]=[];
    if(aggregateOnly&&!registrations.length)dataWarnings.push('API-Kohorte nur aggregiert');
    else if(unknownPath)dataWarnings.push('Trafficpfad unbekannt · Identitätsmetriken deaktiviert');
    else if(!matureRegistrations.length)dataWarnings.push(registrations.length?'Kohorte noch nicht reif':'Keine nutzerverknüpfbaren Registrierungen');
    else if(!cohortReliable)dataWarnings.push('Join-Coverage unter 80 % · Identitätsmetriken unbekannt');
    if((Object.keys(eventTotals)as (keyof typeof eventTotals)[]).some(type=>eventTotals[type]===0&&joinedTotals[type]>0))dataWarnings.push('Widerspruch zwischen Report und Conversion-Cache · Identitätsmetriken unbekannt');
    if(coinUsers.size&&baseline===null)dataWarnings.push('Keine passende Offer-Baseline');
    if(zeroProbability!==null){
      fraudScore=zeroProbability<=.01?65:zeroProbability<=.05?50:zeroProbability<=.15?35:25;
      reasons.push(`${coinUsers.size} unabhängige Coin-Nutzer ohne Zahler · Null-Sale-Wahrscheinlichkeit ${(zeroProbability*100).toFixed(2).replace('.',',')} %`);
    }
    if(timingRows.length>=30&&timingRate!==null){if(timingRate>=.2){fraudScore=Math.max(fraudScore,70);reasons.push(`${(timingRate*100).toFixed(1).replace('.',',')} % der tracked SOIs in höchstens 15 Sekunden`)}else if(timingRate>=.05){fraudScore=Math.max(fraudScore,50);reasons.push(`${(timingRate*100).toFixed(1).replace('.',',')} % sehr schnelle tracked SOIs`)}}
    const profit=totals.revenue-totals.payout,identityIncomplete=!identityBlocked&&([['coin_spend',coinCoverage],['first_sale',saleCoverage],['rebill',rebillCoverage]]as const).some(([type,coverage])=>(eventTotals[type]>0||joinedTotals[type]>0)&&!identityReliable(type,coverage)),qualityScore=Math.min(100,(profit<0?25:0)+(totals.sois>=30&&totals.firstSales===0?25:0)+(totals.sois>=100&&totals.rebills===0?15:0)),rebillDistribution=[...rebillCounts.values()].sort((a,b)=>b-a),rebillEventCount=rebillDistribution.reduce((sum,count)=>sum+count,0),rebillConcentration=identityBlocked||!identityReliable('rebill',rebillCoverage)?{status:'unknown' as const,customers:null,events:null,top1Share:null,top2Share:null}:{status:'available' as const,customers:rebillDistribution.length,events:rebillEventCount,top1Share:rebillEventCount?(rebillDistribution[0]||0)/rebillEventCount:null,top2Share:rebillEventCount?((rebillDistribution[0]||0)+(rebillDistribution[1]||0))/rebillEventCount:null};
    results.push({key,affiliateId:seed.affiliateId,affiliateName:seed.affiliateName,offerId:seed.offerId,offerName:seed.offerName,campaignId:seed.campaignId,campaignName:seed.campaignName,offerUrlId:seed.offerUrlId,offerUrlName:seed.offerUrlName,trafficMode:seed.trafficMode,source:seed.source,subSource:seed.subSource,sourceDimension:seed.sourceDimension||'unknown',subSourceDimension:seed.subSourceDimension||'unknown',metrics:{...totals,profit},cohort:{mode:cohortMode,matureLeads:identityBlocked?0:matureRegistrations.length,coinUsers:identityBlocked||!cohortReliable?0:coinUsers.size,saleUsers:identityBlocked||!cohortReliable?0:saleUsers.size,rebillUsers:identityBlocked||!identityReliable('rebill',rebillCoverage)?0:rebillUsers.size,coinEvents:cohortMode==='aggregate_only'?totals.coinEvents:unknownPath?0:joinedCoinEvents},baseline,coinZeroSaleProbability:zeroProbability,timing:{eligible:seed.trafficMode==='tracked_direct'||seed.trafficMode==='tracked_smartlink',total:timingRows.length,under15Seconds:under15,under15Rate:timingRate},rebillConcentration,joinCoverage:{coinSpend:coinCoverage,firstSale:saleCoverage,rebill:rebillCoverage,threshold:coverageThreshold},qualityScore,fraudScore,riskLevel:fraudScore===0&&(identityIncomplete||identityBlocked)?'unbekannt':level(fraudScore),reasons,dataWarnings});
  }
  return results.sort((a,b)=>b.fraudScore-a.fraudScore||b.qualityScore-a.qualityScore||a.key.localeCompare(b.key));
}

export type FraudStopRequest={id:string;affiliateId:string;source:string|null;subSource:string|null;sourceDimension?:FraudSourceIdentity['sourceDimension']|null;subSourceDimension?:FraudSourceIdentity['subSourceDimension']|null;offerId:string|null;requestedAt:string;graceHours:number;channel:string};
export type StopComplianceEvaluation={id:string;classification:'stop_compliance';status:'ausstehend'|'eingehalten'|'verstoß';deadline:string;leadsAfterDeadline:number;payoutAfterDeadline:number;affectedOfferIds:string[];firstLeadAfterDeadline:string|null;lastLeadAfterDeadline:string|null};

export function evaluateStopCompliance(stops:FraudStopRequest[],conversions:FraudConversionInput[],now=new Date()):StopComplianceEvaluation[]{
  return stops.map(stop=>{
    const deadline=new Date(Date.parse(stop.requestedAt)+stop.graceHours*3_600_000).toISOString();
    const rows=conversions.filter(row=>row.type==='soi'&&approved(row)&&row.affiliateId===stop.affiliateId&&(!stop.source||row.source===stop.source)&&(!stop.subSource||row.subSource===stop.subSource)&&(!stop.sourceDimension||row.sourceDimension===stop.sourceDimension)&&(!stop.subSourceDimension||row.subSourceDimension===stop.subSourceDimension)&&(!stop.offerId||row.offerId===stop.offerId)&&Date.parse(row.convertedAt)>=Date.parse(deadline)).sort((a,b)=>Date.parse(a.convertedAt)-Date.parse(b.convertedAt));
    return{id:stop.id,classification:'stop_compliance' as const,status:now.getTime()<Date.parse(deadline)?'ausstehend' as const:rows.length?'verstoß' as const:'eingehalten' as const,deadline,leadsAfterDeadline:rows.length,payoutAfterDeadline:rows.reduce((sum,row)=>sum+row.payout,0),affectedOfferIds:[...new Set(rows.map(row=>row.offerId))].sort(),firstLeadAfterDeadline:rows[0]?.convertedAt||null,lastLeadAfterDeadline:rows.at(-1)?.convertedAt||null};
  });
}
