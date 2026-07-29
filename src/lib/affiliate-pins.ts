export type AffiliateChoice={id:string;name:string};
export type AffiliateTrafficFilter='all'|'smartlinks'|'direct';
export type AffiliateTrafficChoice=AffiliateChoice&{directCount:number;campaignCount:number};

export function parseAffiliatePins(raw:string|null){
 if(!raw)return[];
 try{
  const value=JSON.parse(raw);
  if(!Array.isArray(value))return[];
  return [...new Set(value.filter((id):id is string=>typeof id==='string'&&id.length>0&&id.length<=64))].slice(0,100);
 }catch{return[]}
}

export function toggleAffiliatePin(pins:string[],id:string){
 return pins.includes(id)?pins.filter(pin=>pin!==id):[...pins,id].slice(-100);
}

export function filterAffiliateChoices<T extends AffiliateTrafficChoice>(partners:T[],filter:AffiliateTrafficFilter){
 if(filter==='direct')return partners.filter(partner=>partner.directCount>0);
 if(filter==='smartlinks')return partners.filter(partner=>partner.campaignCount>0);
 return partners;
}

export function sortAffiliateChoices<T extends AffiliateChoice>(partners:T[],pins:string[],query:string){
 const normalized=query.trim().toLocaleLowerCase('de-DE'),pinOrder=new Map(pins.map((id,index)=>[id,index]));
 return partners.filter(partner=>!normalized||partner.id.toLocaleLowerCase('de-DE').includes(normalized)||partner.name.toLocaleLowerCase('de-DE').includes(normalized)).sort((a,b)=>{
  const aPin=pinOrder.get(a.id),bPin=pinOrder.get(b.id);
  if(aPin!==undefined||bPin!==undefined){if(aPin===undefined)return 1;if(bPin===undefined)return-1;return aPin-bPin}
  return a.name.localeCompare(b.name,'de-DE',{numeric:true,sensitivity:'base'});
 });
}
