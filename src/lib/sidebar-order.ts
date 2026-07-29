export function parseSidebarOrder(raw:string|null,known:string[]){
 if(!raw)return[...known];
 try{
  const value=JSON.parse(raw);
  if(!Array.isArray(value))return[...known];
  const allowed=new Set(known),seen=new Set<string>(),saved=value.filter((item):item is string=>typeof item==='string'&&allowed.has(item)&&!seen.has(item)&&(seen.add(item),true));
  return[...saved,...known.filter(item=>!seen.has(item))];
 }catch{return[...known]}
}

export function moveSidebarItem(order:string[],source:string,target:string){
 if(source===target||!order.includes(source)||!order.includes(target))return[...order];
 const targetIndex=order.indexOf(target),next=order.filter(item=>item!==source);
 next.splice(targetIndex,0,source);
 return next;
}

export function moveSidebarItemByVisibleOrder(order:string[],visible:string[],source:string,direction:-1|1){
 const index=visible.indexOf(source),target=visible[index+direction];
 return target?moveSidebarItem(order,source,target):[...order];
}
