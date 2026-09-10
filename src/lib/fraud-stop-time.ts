export function fraudStopDeadline(value:string|null){
 return value?new Intl.DateTimeFormat('de-DE',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}).format(new Date(value)):'–';
}
