const normalize=(value:string)=>value.trim().toLocaleLowerCase('de-DE');
const tokens=(query:string)=>normalize(query).split(/[\s/|;,]+/).filter(Boolean);

export function rankSourceMatches<T>(items:readonly T[],query:string,values:(item:T)=>readonly (string|null|undefined)[]):T[]{
 const normalizedQuery=normalize(query);
 if(!normalizedQuery)return [...items];
 const queryTokens=tokens(query);
 return items.map((item,index)=>{
  const itemValues=values(item).filter((value):value is string=>Boolean(value)).map(normalize);
  const searchable=itemValues.join(' ');
  if(!queryTokens.every(token=>searchable.includes(token)))return null;
  const exactValue=itemValues.includes(normalizedQuery);
  const exactTokens=queryTokens.every(token=>itemValues.includes(token));
  const startsWith=queryTokens.every(token=>itemValues.some(value=>value.startsWith(token)));
  return {item,index,rank:exactValue?0:exactTokens?1:startsWith?2:3};
 }).filter((match):match is {item:T;index:number;rank:number}=>match!==null).sort((a,b)=>a.rank-b.rank||a.index-b.index).map(match=>match.item);
}

export function rankNestedSourceMatches<Group extends {leaves:unknown[]}>(
 groups:readonly Group[],query:string,parentValue:(group:Group)=>string|null|undefined,leafValue:(leaf:Group['leaves'][number])=>string|null|undefined,
):Group[]{
 const matched=rankSourceMatches(groups,query,group=>[parentValue(group),...group.leaves.map(leafValue)]);
 if(!normalize(query))return matched;
 return matched.map(group=>{
  const normalizedParent=normalize(parentValue(group)||''),queryTokens=tokens(query);
  const exactLeaves=group.leaves.filter(leaf=>{const normalizedLeaf=normalize(leafValue(leaf)||'');return Boolean(normalizedLeaf)&&queryTokens.includes(normalizedLeaf)&&queryTokens.every(token=>normalizedParent.includes(token)||normalizedLeaf.includes(token))});
  if(exactLeaves.length)return{...group,leaves:exactLeaves};
  const parentMatches=rankSourceMatches([group],query,item=>[parentValue(item)]).length>0;
  if(parentMatches)return group;
  return{...group,leaves:rankSourceMatches(group.leaves,query,leaf=>[parentValue(group),leafValue(leaf)])};
 }).filter(group=>group.leaves.length>0);
}
