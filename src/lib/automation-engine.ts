import type {AutomationConfiguration,AutomationObjective,AutomationSlot} from './automation-config';

export type AutomationVariantMetrics={offerUrlId:number;clicks:number;sois:number;cvr:number;firstSales:number;rebills:number;revenue:number;payout:number;profit:number;independentPayers:number|null;top1RevenueShare:number|null;ageHours:number;mature:boolean};
export type AutomationProgress=AutomationVariantMetrics&{targetSois:number;remainingSois:number;minClicks:number;remainingClicks:number;minAgeHours:number;remainingAgeHours:number;gateReached:boolean;economicallyRobust:boolean};
export type AutomationDecision={type:'hold'|'replace_slot'|'rotate_round'|'promote';reasonCode:string;fromOfferUrlIds?:number[];toOfferUrlIds?:number[]};
export type AutomationEvaluation={evaluatedAt:string;action:AutomationDecision;progress:AutomationProgress[];targetSlots:AutomationSlot[];writesPlanned:number;blockers:string[]};

const finite=(value:number)=>Number.isFinite(value);
const weights=(slots:Omit<AutomationSlot,'weight'>[]):AutomationSlot[]=>{const base=Math.floor(10000/slots.length)/100;return slots.map((slot,index)=>({...slot,weight:index===0?Number((100-base*(slots.length-1)).toFixed(2)):base}))};
const withoutWeight=(slot:AutomationSlot)=>({offerId:slot.offerId,offerUrlId:slot.offerUrlId,familyKey:slot.familyKey,familyName:slot.familyName,offerUrlName:slot.offerUrlName});
const candidateSlots=(config:AutomationConfiguration)=>config.offers.flatMap(offer=>offer.landingpages.filter(lp=>lp.selection==='candidate').map(lp=>({offerId:offer.offerId,offerUrlId:lp.offerUrlId,familyKey:lp.familyKey,familyName:lp.familyName,offerUrlName:lp.offerUrlName})));
const concentrationAvailable=(metric:AutomationVariantMetrics)=>metric.independentPayers!==null&&metric.top1RevenueShare!==null;
const robust=(metric:AutomationVariantMetrics,config:AutomationConfiguration)=>metric.mature
 &&concentrationAvailable(metric)
 &&metric.firstSales>=config.thresholds.minIndependentFirstSales
 &&metric.independentPayers!>=config.thresholds.minIndependentPayers
 &&metric.profit>0
 &&metric.top1RevenueShare!<=0.75;

function objectiveScore(metric:AutomationProgress,objective:AutomationObjective){
 if(objective==='sale_first')return metric.firstSales/metric.sois;
 if(objective==='profit_epc')return metric.profit/metric.clicks;
 return metric.profit/metric.sois;
}

export function evaluateAutomation(config:AutomationConfiguration,metrics:AutomationVariantMetrics[],now=new Date()):AutomationEvaluation{
 const supported=(config.testMode==='single_offer'&&(config.strategy==='equal_slots'||config.strategy==='champion_challenger'))||(config.testMode==='multi_offer'&&config.strategy==='matched_rounds');
 if(!supported)return{evaluatedAt:now.toISOString(),action:{type:'hold',reasonCode:'unsupported_strategy'},progress:[],targetSlots:config.slots,writesPlanned:0,blockers:['Strategie passt nicht zum Testtyp.']};
 const byId=new Map(metrics.map(metric=>[metric.offerUrlId,metric])),blockers:string[]=[];
 for(const slot of config.slots)if(!byId.has(slot.offerUrlId))blockers.push(`Kennzahlen für LP #${slot.offerUrlId} fehlen.`);
 const numericMetrics=metrics.every(metric=>[metric.clicks,metric.sois,metric.cvr,metric.firstSales,metric.rebills,metric.revenue,metric.payout,metric.profit,metric.ageHours].every(finite));
 const concentrationMetrics=metrics.every(metric=>(metric.independentPayers===null||finite(metric.independentPayers))&&(metric.top1RevenueShare===null||finite(metric.top1RevenueShare)));
 if(!numericMetrics||!concentrationMetrics)blockers.push('Nicht-finite Kennzahlen blockieren die Bewertung.');
 const progress=config.slots.flatMap(slot=>{
  const metric=byId.get(slot.offerUrlId);
  if(!metric)return[];
  return[{
   ...metric,
   targetSois:config.thresholds.targetSois,
   remainingSois:Math.max(0,config.thresholds.targetSois-metric.sois),
   minClicks:config.thresholds.minClicks,
   remainingClicks:Math.max(0,config.thresholds.minClicks-metric.clicks),
   minAgeHours:config.thresholds.minAgeHours,
   remainingAgeHours:Math.max(0,config.thresholds.minAgeHours-metric.ageHours),
   gateReached:metric.clicks>=config.thresholds.minClicks&&metric.sois>=config.thresholds.targetSois&&metric.ageHours>=config.thresholds.minAgeHours,
   economicallyRobust:robust(metric,config),
  }];
 });
 const hold=(reasonCode:string):AutomationEvaluation=>({evaluatedAt:now.toISOString(),action:{type:'hold',reasonCode},progress,targetSlots:config.slots,writesPlanned:0,blockers});
 if(blockers.length)return hold('metrics_incomplete');
 if(progress.some(item=>item.clicks<config.thresholds.minClicks))return hold('test_running');
 if(progress.some(item=>!item.gateReached&&item.ageHours<config.thresholds.maxAgeHours))return hold('test_running');
 const candidates=candidateSlots(config);
 if(config.testMode==='multi_offer'&&config.strategy==='matched_rounds'){
  if(progress.some(item=>!item.economicallyRobust))return hold('economic_evidence_not_robust');
  const families=new Map<string,typeof candidates>();
  for(const candidate of candidates){const items=families.get(candidate.familyKey)||[];items.push(candidate);families.set(candidate.familyKey,items)}
  const next=[...families.values()].find(group=>config.offers.every(offer=>group.some(slot=>slot.offerId===offer.offerId)));
  if(!next)return hold('no_complete_candidate_family');
  const ordered=config.offers.map(offer=>next.find(slot=>slot.offerId===offer.offerId)).filter((slot):slot is NonNullable<typeof slot>=>Boolean(slot));
  return{evaluatedAt:now.toISOString(),action:{type:'rotate_round',reasonCode:'matched_round_complete',fromOfferUrlIds:config.slots.map(x=>x.offerUrlId),toOfferUrlIds:ordered.map(x=>x.offerUrlId)},progress,targetSlots:weights(ordered),writesPlanned:1,blockers};
 }
 const loser=progress.find(item=>concentrationAvailable(item)&&item.mature&&!robust(item,config)&&(item.firstSales<config.thresholds.minIndependentFirstSales||item.independentPayers!<config.thresholds.minIndependentPayers||item.profit<=0));
 if(loser){
  const old=config.slots.find(slot=>slot.offerUrlId===loser.offerUrlId),candidate=candidates.find(slot=>slot.offerId===old?.offerId);
  if(candidate){const target=config.slots.map(slot=>slot.offerUrlId===loser.offerUrlId?candidate:withoutWeight(slot));return{evaluatedAt:now.toISOString(),action:{type:'replace_slot',reasonCode:'mature_economic_loser',fromOfferUrlIds:[loser.offerUrlId],toOfferUrlIds:[candidate.offerUrlId]},progress,targetSlots:weights(target),writesPlanned:1,blockers}}
  return hold('no_safe_candidate');
 }
 if(progress.some(item=>!item.economicallyRobust))return hold('economic_evidence_not_robust');
 if(config.weights.mode==='champion_challenger'&&progress.length===3){
  const leader=[...progress].sort((a,b)=>objectiveScore(b,config.objective)-objectiveScore(a,config.objective)||(a.offerUrlId===config.weights.championOfferUrlId?-1:b.offerUrlId===config.weights.championOfferUrlId?1:a.offerUrlId-b.offerUrlId))[0];
  const target=config.slots.map(slot=>({...slot,weight:slot.offerUrlId===leader.offerUrlId?50:25}));
  return{evaluatedAt:now.toISOString(),action:{type:'promote',reasonCode:`robust_${config.objective}_leader`,toOfferUrlIds:[leader.offerUrlId]},progress,targetSlots:target,writesPlanned:1,blockers};
 }
 return hold('no_clear_economic_winner');
}
