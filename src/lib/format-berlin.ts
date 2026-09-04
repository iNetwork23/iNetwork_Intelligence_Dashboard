/** Einheitliche Berlin-Datumsformate für Sperr-, Rollup- und Historie-Zeiten (client-sicher): immer vierstelliges Jahr. */
const DAY=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric'});
const DAY_TIME=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const parse=(value:string|Date)=>{const date=value instanceof Date?value:new Date(/^\d{4}-\d{2}-\d{2}$/.test(value)?`${value}T12:00:00+02:00`:value);return Number.isNaN(date.getTime())?null:date};
/** dd.MM.yyyy (Tagesangaben wie 2026-09-04 werden als Berliner Kalendertag gelesen). */
export const berlinDay=(value:string|Date)=>{const date=parse(value);return date?DAY.format(date):String(value)};
/** dd.MM.yyyy, HH:mm */
export const berlinDateTime=(value:string|Date)=>{const date=parse(value);return date?DAY_TIME.format(date):String(value)};
