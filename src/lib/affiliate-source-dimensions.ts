export const isApiOffer=(name:string)=>/(^|[\s–—-])API([\s–—-]|$)/i.test(name.trim());
export type SourceDimensionRow={columns:{column_type:string;id:string;label:string}[];reporting:Record<string,number>};
const dim=(row:SourceDimensionRow,type:string)=>row.columns.find(column=>column.column_type===type);
export function normalizeAffiliateSourceDimensions<T extends SourceDimensionRow>(row:T):T{
  const offer=dim(row,'offer');
  if(!offer||!isApiOffer(offer.label))return row;
  const adv1=dim(row,'adv1'),adv2=dim(row,'adv2');
  const source={column_type:'source_id',id:adv1?.id||'N/A',label:adv1?.label||adv1?.id||'N/A'};
  const sub={column_type:'sub1',id:adv2?.id||'N/A',label:adv2?.label||adv2?.id||'N/A'};
  return{...row,columns:[...row.columns.filter(column=>column.column_type!=='source_id'&&column.column_type!=='sub1'),source,sub]};
}
