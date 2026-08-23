const DAY_MS=86_400_000;
const iso=(ms:number)=>new Date(ms).toISOString().slice(0,10);
const parse=(day:string)=>Date.parse(`${day}T12:00:00Z`);

export function previousWindow(from:string,to:string){
 const start=parse(from),end=parse(to),length=Math.round((end-start)/DAY_MS)+1,prevEnd=start-DAY_MS;
 return{from:iso(prevEnd-(length-1)*DAY_MS),to:iso(prevEnd)};
}
