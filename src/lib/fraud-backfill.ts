export type FraudConversionType='soi'|'coin_spend'|'first_sale'|'rebill';
export type FraudTypeCounts=Record<FraudConversionType,number>;
export type FraudBackfillEvidence={typeCounts:FraudTypeCounts;identityDigest:string};
export type FraudBackfillParity={from:string;to:string;expected:FraudTypeCounts;stored:FraudTypeCounts;expectedDigest:string;storedDigest:string;reportHasActivity:boolean;verified:boolean};
const fraudTypes:FraudConversionType[]=['soi','coin_spend','first_sale','rebill'];
export function buildFraudBackfillParity(input:{from:string;to:string;expected:FraudBackfillEvidence;stored:FraudBackfillEvidence;reportHasActivity:boolean}):FraudBackfillParity{
  const countsMatch=fraudTypes.every(type=>input.expected.typeCounts[type]===input.stored.typeCounts[type]),identitiesMatch=input.expected.identityDigest===input.stored.identityDigest,total=fraudTypes.reduce((sum,type)=>sum+input.expected.typeCounts[type],0),verified=countsMatch&&identitiesMatch&&!(total===0&&input.reportHasActivity);
  return{from:input.from,to:input.to,expected:input.expected.typeCounts,stored:input.stored.typeCounts,expectedDigest:input.expected.identityDigest,storedDigest:input.stored.identityDigest,reportHasActivity:input.reportHasActivity,verified};
}
const strongParity=(value:FraudBackfillParity|null|undefined)=>Boolean(value&&value.verified&&value.expectedDigest&&value.expectedDigest===value.storedDigest&&fraudTypes.every(type=>value.expected[type]===value.stored[type])&&!(value.reportHasActivity&&fraudTypes.every(type=>value.expected[type]===0)));
export type FraudBackfillState={version:3;phase:'backfill'|'rolling';windowFrom:string;windowTo:string;nextFrom:string;coveredFrom:string|null;coveredThrough:string|null;parityVerifiedThrough:string|null;lastParity:FraudBackfillParity|null;readyAt:string|null;lastSuccessAt:string|null};
export type StoredFraudBackfillState=Omit<FraudBackfillState,'parityVerifiedThrough'|'lastParity'>&Partial<Pick<FraudBackfillState,'parityVerifiedThrough'|'lastParity'>>;
export type FraudBackfillWindow={mode:'backfill'|'rolling';from:string;to:string};
const berlinDay=(date:Date)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(date);
const shift=(day:string,offset:number)=>{const date=new Date(`${day}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10)};
const validDay=(day:string)=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&!Number.isNaN(Date.parse(`${day}T12:00:00Z`));

export function initialFraudBackfillState(now=new Date(),requiredFrom?:string):FraudBackfillState{
  const windowTo=berlinDay(now),defaultFrom=shift(windowTo,-119),windowFrom=requiredFrom&&validDay(requiredFrom)&&requiredFrom<defaultFrom?requiredFrom:defaultFrom;
  return{version:3,phase:'backfill',windowFrom,windowTo,nextFrom:windowFrom,coveredFrom:null,coveredThrough:null,parityVerifiedThrough:null,lastParity:null,readyAt:null,lastSuccessAt:null};
}
export function normalizeFraudBackfillState(value:StoredFraudBackfillState):FraudBackfillState{
  const normalized:FraudBackfillState={...value,parityVerifiedThrough:value.parityVerifiedThrough||null,lastParity:value.lastParity||null};
  if(normalized.phase==='rolling'&&(!normalized.parityVerifiedThrough||!strongParity(normalized.lastParity)||normalized.lastParity?.to!==normalized.parityVerifiedThrough))return{...normalized,phase:'backfill',nextFrom:normalized.windowFrom,coveredFrom:null,coveredThrough:null,parityVerifiedThrough:null,lastParity:null,readyAt:null};
  return normalized;
}
export function requireFraudCoverageFrom(state:FraudBackfillState,requiredFrom:string,now=new Date()):FraudBackfillState{
  if(!validDay(requiredFrom)||requiredFrom>=state.windowFrom)return state;
  const windowTo=berlinDay(now);
  return{...state,phase:'backfill',windowFrom:requiredFrom,windowTo:windowTo>state.windowTo?windowTo:state.windowTo,nextFrom:requiredFrom,coveredFrom:null,coveredThrough:null,parityVerifiedThrough:null,lastParity:null,readyAt:null};
}
export function invalidateFraudBackfillState(state:FraudBackfillState):FraudBackfillState{return{...state,readyAt:null,parityVerifiedThrough:null,lastParity:null}}
export function selectFraudBackfillWindow(state:FraudBackfillState,now=new Date()):FraudBackfillWindow{
  if(state.version!==3)throw new Error('Unbekannte Fraud-Backfill-Version');
  if(state.phase==='rolling'){
    const to=berlinDay(now),covered=state.coveredThrough||state.windowTo,catchupFrom=shift(covered,1);
    if(catchupFrom<=to){const proposed=shift(catchupFrom,6);return{mode:'rolling',from:catchupFrom,to:proposed>to?to:proposed}}
    return{mode:'rolling',from:shift(to,-2),to};
  }
  const proposed=shift(state.nextFrom,6);return{mode:'backfill',from:state.nextFrom,to:proposed>state.windowTo?state.windowTo:proposed};
}
export function advanceFraudBackfillState(state:FraudBackfillState,window:FraudBackfillWindow,now:Date,newParity:FraudBackfillParity):FraudBackfillState{
  if(!strongParity(newParity)||newParity.from!==window.from||newParity.to!==window.to)throw new Error('Fraud-Backfill-Parity ist nicht verifiziert');
  const nextFrom=shift(window.to,1),complete=window.mode==='backfill'&&nextFrom>state.windowTo;
  if(window.mode==='rolling'){
    const previous=state.coveredThrough||state.windowTo;
    if(window.from>shift(previous,1))throw new Error('Fraud-Backfill-Coverage ist nicht lückenlos');
    const coveredThrough=window.to>previous?window.to:previous,parityVerifiedThrough=window.to>(state.parityVerifiedThrough||'')?window.to:state.parityVerifiedThrough;
    return{...state,nextFrom:shift(coveredThrough,1),coveredThrough,parityVerifiedThrough,lastParity:newParity,lastSuccessAt:now.toISOString()};
  }
  return{...state,phase:complete?'rolling':state.phase,nextFrom,coveredFrom:complete?state.windowFrom:state.coveredFrom,coveredThrough:complete?window.to:state.coveredThrough,parityVerifiedThrough:window.to,lastParity:newParity,readyAt:complete?now.toISOString():state.readyAt,lastSuccessAt:now.toISOString()};
}
