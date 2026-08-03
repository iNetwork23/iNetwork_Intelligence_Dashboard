export type AutomationStatus='draft'|'dry_run'|'awaiting_live'|'active'|'paused'|'hold'|'completed';
export type AutomationTestMode='single_offer'|'multi_offer';
export type AutomationStrategy='equal_slots'|'champion_challenger'|'matched_rounds';
export type AutomationObjective='sale_first'|'profit_per_soi'|'profit_epc';
export type AutomationLandingpage={familyKey:string;familyName:string;offerUrlId:number;offerUrlName:string;status:string;selection:'active'|'candidate'|'excluded'};
export type AutomationOffer={offerId:number;offerName:string;landingpages:AutomationLandingpage[]};
export type AutomationThresholds={targetSois:number;minClicks:number;minAgeHours:number;maxAgeHours:number;maturityHours:number;minIndependentFirstSales:number;minIndependentPayers:number};
export type AutomationSlot={offerId:number;offerUrlId:number;familyKey:string;familyName:string;offerUrlName:string;weight:number};
export type AutomationConfiguration={
 schemaVersion:1;id:string;name:string;affiliateId:number;campaignId:number;testMode:AutomationTestMode;strategy:AutomationStrategy;objective:AutomationObjective;
 offers:AutomationOffer[];schedule:{intervalMinutes:number};thresholds:AutomationThresholds;weights:{mode:'equal'|'champion_challenger';championOfferUrlId?:number};
 slots:AutomationSlot[];status:AutomationStatus;writeEnabled:boolean;version:number;createdAt:string;updatedAt:string;
};
export type AutomationThresholdRecommendation={targetSois:number;minClicks:number;minAgeHours:number;maxAgeHours:number;maturityHours:number;estimatedDays:number|null;confidence:'recommended'|'insufficient_data';rationale:string[];blockers:string[]};

type InputRecord=Record<string,unknown>;
const object=(value:unknown):InputRecord=>value&&typeof value==='object'&&!Array.isArray(value)?value as InputRecord:{};
const text=(value:unknown,fallback='')=>typeof value==='string'?value.trim():fallback;
const positiveInt=(value:unknown,fallback:number)=>Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):fallback;
const enumValue=<T extends string>(value:unknown,allowed:readonly T[],fallback:T):T=>typeof value==='string'&&(allowed as readonly string[]).includes(value)?value as T:fallback;
const strategyFor=(value:unknown,testMode:AutomationTestMode):AutomationStrategy=>{const allowed:readonly AutomationStrategy[]=testMode==='multi_offer'?['matched_rounds']:['equal_slots','champion_challenger'],fallback:AutomationStrategy=testMode==='multi_offer'?'matched_rounds':'equal_slots';if(value===undefined||value===null||value==='')return fallback;if(typeof value!=='string'||!allowed.includes(value as AutomationStrategy))throw new Error('Automationsstrategie wird für diesen Testtyp nicht unterstützt.');return value as AutomationStrategy};
const round2=(value:number)=>Number(value.toFixed(2));
const equalWeights=(count:number)=>Array.from({length:count},(_,index)=>round2(index===0?100-(Math.floor(10000/count)/100)*(count-1):Math.floor(10000/count)/100));

export function normalizeAutomationDraft(raw:unknown,now=new Date()):AutomationConfiguration{
 const input=object(raw),offersRaw=Array.isArray(input.offers)?input.offers:[];
 const offers:AutomationOffer[]=offersRaw.slice(0,20).map(item=>{const offer=object(item),landingpagesRaw=Array.isArray(offer.landingpages)?offer.landingpages:[];return{
  offerId:positiveInt(offer.offerId,0),offerName:text(offer.offerName,`Offer #${positiveInt(offer.offerId,0)}`),landingpages:landingpagesRaw.slice(0,100).map(value=>{const lp=object(value);return{familyKey:text(lp.familyKey).toLowerCase(),familyName:text(lp.familyName),offerUrlId:positiveInt(lp.offerUrlId,0),offerUrlName:text(lp.offerUrlName),status:text(lp.status,'unknown').toLowerCase(),selection:enumValue(lp.selection,['active','candidate','excluded'] as const,'active')}}),
 }});
 const candidates=offers.flatMap(offer=>offer.landingpages.filter(lp=>lp.selection==='active').map(lp=>({offerId:offer.offerId,offerUrlId:lp.offerUrlId,familyKey:lp.familyKey,familyName:lp.familyName,offerUrlName:lp.offerUrlName})));
 const weights=equalWeights(candidates.length),date=now.toISOString(),schedule=object(input.schedule),thresholds=object(input.thresholds),weightInput=object(input.weights),weightMode=enumValue(weightInput.mode,['equal','champion_challenger'] as const,'equal'),championOfferUrlId=positiveInt(weightInput.championOfferUrlId,0),testMode=enumValue(input.testMode,['single_offer','multi_offer'] as const,'single_offer'),strategy=strategyFor(input.strategy,testMode);
 return{
  schemaVersion:1,id:text(input.id)||crypto.randomUUID(),name:text(input.name,'Neue Smartlink-Automation').slice(0,120),affiliateId:positiveInt(input.affiliateId,0),campaignId:positiveInt(input.campaignId,0),
  testMode,strategy,objective:enumValue(input.objective,['sale_first','profit_per_soi','profit_epc'] as const,'sale_first'),offers,
  schedule:{intervalMinutes:Math.min(1440,Math.max(15,positiveInt(schedule.intervalMinutes,120)))},
  thresholds:{targetSois:positiveInt(thresholds.targetSois,50),minClicks:positiveInt(thresholds.minClicks,500),minAgeHours:positiveInt(thresholds.minAgeHours,24),maxAgeHours:positiveInt(thresholds.maxAgeHours,336),maturityHours:positiveInt(thresholds.maturityHours,168),minIndependentFirstSales:positiveInt(thresholds.minIndependentFirstSales,3),minIndependentPayers:positiveInt(thresholds.minIndependentPayers,3)},
  weights:{mode:weightMode,...(championOfferUrlId?{championOfferUrlId}:{})},
  slots:candidates.map((slot,index)=>({...slot,weight:weightMode==='champion_challenger'&&candidates.length===3?(slot.offerUrlId===championOfferUrlId?50:25):(weights[index]||0)})),status:'draft',writeEnabled:false,version:1,createdAt:date,updatedAt:date,
 };
}

export function validateAutomationDraft(config:AutomationConfiguration):string[]{
 const errors:string[]=[];
 if(config.affiliateId<=0)errors.push('Affiliate-ID fehlt.');if(config.campaignId<=0)errors.push('Campaign-ID fehlt.');
 if(config.testMode==='single_offer'&&config.offers.length!==1)errors.push('Single-Offer-Tests benötigen genau ein Offer.');
 if(config.testMode==='multi_offer'&&config.offers.length<2)errors.push('Multi-Offer-Tests benötigen mindestens zwei Offers.');
 if((config.testMode==='single_offer'&&!['equal_slots','champion_challenger'].includes(config.strategy as string))||(config.testMode==='multi_offer'&&config.strategy!=='matched_rounds'))errors.push('Strategie passt nicht zum Testtyp.');
 if(config.slots.length<2)errors.push('Mindestens zwei Landingpage-Varianten sind erforderlich.');
 const offerIds=new Set<number>(),urlIds=new Set<number>();
 for(const offer of config.offers){if(offerIds.has(offer.offerId))errors.push(`Offer #${offer.offerId} ist mehrfach zugeordnet.`);offerIds.add(offer.offerId);for(const lp of offer.landingpages){if(urlIds.has(lp.offerUrlId))errors.push(`Offer-URL-ID ${lp.offerUrlId} ist mehrfach zugeordnet.`);urlIds.add(lp.offerUrlId);if(lp.status!=='active')errors.push(`Landingpage #${lp.offerUrlId} ist nicht aktiv.`);if(!lp.familyKey||!lp.familyName)errors.push(`Landingpage #${lp.offerUrlId} hat keine bestätigte LP-Familie.`)}}
 if(config.testMode==='multi_offer'&&config.strategy==='matched_rounds'){
  const families=new Map<string,string>();for(const offer of config.offers)for(const lp of offer.landingpages)families.set(lp.familyKey,lp.familyName);
  for(const [key,name] of families)for(const offer of config.offers)if(!offer.landingpages.some(lp=>lp.familyKey===key))errors.push(`LP-Familie „${name}“ fehlt bei Offer #${offer.offerId}.`);
 }
 if(config.strategy==='champion_challenger'){if(config.slots.length!==3)errors.push('Champion/Challenger benötigt genau drei aktive Slots.');if(config.weights.mode!=='champion_challenger')errors.push('Champion/Challenger benötigt den passenden Gewichtsmodus.');if(!config.weights.championOfferUrlId||!config.slots.some(slot=>slot.offerUrlId===config.weights.championOfferUrlId))errors.push('Der Champion muss ein aktiver Slot sein.')}else if(config.weights.mode==='champion_challenger')errors.push('Champion-Gewichte sind nur im Champion/Challenger-Modus erlaubt.');
 if(config.thresholds.maxAgeHours<config.thresholds.minAgeHours)errors.push('Maximale Laufzeit liegt vor der Mindestlaufzeit.');
 if(config.slots.some(slot=>!Number.isFinite(slot.weight)||slot.weight<=0))errors.push('Alle Startgewichte müssen endlich und größer als 0 sein.');
 if(Math.abs(config.slots.reduce((sum,slot)=>sum+slot.weight,0)-100)>0.01)errors.push('Startgewichte ergeben nicht 100 %.');
 return [...new Set(errors)];
}

export function recommendAutomationThresholds(input:{variantCount:number;baselineCvr:number;clicksPerDay:number;soisPerDay:number;affiliateId:number}):AutomationThresholdRecommendation{
 const p=Number(input.baselineCvr),clicksPerDay=Number(input.clicksPerDay),soisPerDay=Number(input.soisPerDay),variantCount=positiveInt(input.variantCount,1),blockers:string[]=[];
 if(!Number.isFinite(p)||p<=0||p>=1||!Number.isFinite(clicksPerDay)||clicksPerDay<=0||!Number.isFinite(soisPerDay)||soisPerDay<=0)blockers.push('Keine belastbare Traffic-Baseline verfügbar.');
 const safeP=Number.isFinite(p)&&p>0&&p<1?p:0.01,targetSois=Math.max(40,Math.min(100,Math.ceil(3.8416*(1-safeP)/0.09))),ruleOfThreeClicks=Math.ceil(3/safeP),minClicks=Math.max(ruleOfThreeClicks,Math.ceil(targetSois/safeP));
 const estimatedDays=blockers.length?null:Math.max(minClicks/(clicksPerDay/variantCount),targetSois/(soisPerDay/variantCount));
 return{targetSois,minClicks,minAgeHours:24,maxAgeHours:336,maturityHours:input.affiliateId===436?336:168,estimatedDays:estimatedDays===null?null:round2(estimatedDays),confidence:blockers.length?'insufficient_data':'recommended',rationale:[`Ziel-SOIs aus einem 95-%-Konfidenzintervall mit höchstens 30 % relativer Unsicherheit.`,`Mindestens ${ruleOfThreeClicks} Klicks berücksichtigen die Rule of Three bei null Conversions.`,`Traffic wird auf ${variantCount} Varianten verteilt.`],blockers};
}
