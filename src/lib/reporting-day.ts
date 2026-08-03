const DAY=/^\d{4}-\d{2}-\d{2}$/;
const formatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});

function parts(epoch:number){const values:Record<string,number>={};for(const part of formatter.formatToParts(new Date(epoch)))if(part.type!=='literal')values[part.type]=Number(part.value);return values}
function berlinMidnightUtc(day:string){if(!DAY.test(day)||Number.isNaN(Date.parse(`${day}T12:00:00Z`)))throw new Error('Ungültiger Berichtstag');const[y,m,d]=day.split('-').map(Number),target=Date.UTC(y,m-1,d);let guess=target;for(let i=0;i<4;i++){const value=parts(guess),observed=Date.UTC(value.year,value.month-1,value.day,value.hour===24?0:value.hour,value.minute,value.second),delta=target-observed;guess+=delta;if(delta===0)break}return new Date(guess).toISOString()}
function nextDay(day:string){return new Date(Date.parse(`${day}T12:00:00Z`)+86_400_000).toISOString().slice(0,10)}

export function berlinDayUtcBounds(day:string){return{from:berlinMidnightUtc(day),toExclusive:berlinMidnightUtc(nextDay(day))}}
export function berlinRangeUtcBounds(from:string,to:string){if(from>to)throw new Error('Ungültiger Berichtszeitraum');return{from:berlinDayUtcBounds(from).from,toExclusive:berlinDayUtcBounds(to).toExclusive}}
