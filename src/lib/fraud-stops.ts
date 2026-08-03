export type FraudStopInput={affiliateId?:unknown;source?:unknown;subSource?:unknown;sourceDimension?:unknown;subSourceDimension?:unknown;offerId?:unknown;scope?:unknown;requestedAt?:unknown;graceHours?:unknown;channel?:unknown;reference?:unknown;note?:unknown};
export type FraudStopInsert={affiliate_id:string;source:string|null;sub_source:string|null;source_dimension:'source_id'|'adv1'|null;sub_source_dimension:'sub1'|'sub2'|'sub3'|'sub4'|'sub5'|'adv2'|null;offer_id:string|null;scope:'offer'|'all_offers';requested_at:string;grace_hours:number;channel:string;reference:string|null;note:string|null;created_by:string};

const id=(value:unknown,label:string)=>{const text=String(value??'').trim();if(!/^\d+$/.test(text)||Number(text)<=0)throw new Error(`${label} fehlt oder ist ungültig`);return text};
const optional=(value:unknown,max=200)=>{const text=String(value??'').trim();if(!text)return null;if(text.length>max)throw new Error('Quellen- oder Referenzwert ist zu lang');return text};
const requested=(value:unknown,now:Date)=>{const text=String(value??'').trim(),time=Date.parse(text);if(!text||Number.isNaN(time))throw new Error('Abbestellungszeitpunkt fehlt oder ist ungültig');if(time>now.getTime()+5*60_000)throw new Error('Abbestellungszeitpunkt liegt in der Zukunft');if(time<now.getTime()-366*86_400_000)throw new Error('Abbestellungszeitpunkt liegt außerhalb des Aufbewahrungszeitraums');return new Date(time).toISOString()};

export function normalizeFraudStopInput(input:FraudStopInput,actorId:string,now=new Date()):FraudStopInsert{
  const affiliate_id=id(input.affiliateId,'Affiliate'),source=optional(input.source),sub_source=optional(input.subSource);
  if(!source&&!sub_source)throw new Error('Mindestens eine exakte Quelle oder Unterquelle ist erforderlich');
  const sourceDimension=String(input.sourceDimension??''),subDimension=String(input.subSourceDimension??'');
  const source_dimension=source?(sourceDimension==='source_id'||sourceDimension==='adv1'?sourceDimension:null):null;
  const sub_source_dimension=sub_source?(['sub1','sub2','sub3','sub4','sub5','adv2'].includes(subDimension)?subDimension as FraudStopInsert['sub_source_dimension']:null):null;
  if(source&&!source_dimension||sub_source&&!sub_source_dimension)throw new Error('Quellen-Dimension fehlt oder ist ungültig');
  if(source_dimension==='source_id'&&sub_source_dimension==='adv2'||source_dimension==='adv1'&&sub_source_dimension&&sub_source_dimension!=='adv2')throw new Error('Source- und Sub-Source-Dimension gehören nicht zum selben Trafficpfad');
  const scope=input.scope==='offer'?'offer':input.scope==='all_offers'?'all_offers':null;if(!scope)throw new Error('Stop-Scope ist ungültig');
  const offer_id=scope==='offer'?id(input.offerId,'Offer'):null,grace=Number(input.graceHours??24);if(!Number.isInteger(grace)||grace<1||grace>168)throw new Error('Grace Period muss zwischen 1 und 168 Stunden liegen');
  const channel=optional(input.channel,40)||'telegram',created_by=String(actorId||'').trim();if(!created_by)throw new Error('Actor fehlt');
  return{affiliate_id,source,sub_source,source_dimension,sub_source_dimension,offer_id,scope,requested_at:requested(input.requestedAt,now),grace_hours:grace,channel,reference:optional(input.reference,500),note:optional(input.note,500),created_by};
}
