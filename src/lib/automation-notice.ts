export type AutomationNoticeTone='ok'|'error'|'info';
export type AutomationNotice={tone:AutomationNoticeTone;text:string};
type DecisionShape={type?:string;reasonCode?:string;fromOfferUrlIds?:number[];toOfferUrlIds?:number[]};
type RunPayload={evaluation?:{action?:DecisionShape};writesPerformed?:number};
const decisionLabels:Record<string,string>={replace_slot:'Slot ersetzt',rotate_round:'Runde rotiert',promote:'Champion gesetzt'};
const actionLabels:Record<string,string>={create:'Entwurf gespeichert',update:'Konfiguration aktualisiert',request_live:'Live angefordert',activate_live:'Live aktiviert',pause:'Pausiert',resume:'Fortgesetzt',complete:'Beendet',import_legacy:'Als Entwurf importiert'};
const compensationLabels:Record<string,string>={not_needed:'nicht nötig',verified:'verifiziert',failed:'fehlgeschlagen',uncertain:'unklar'};
const lpList=(ids:number[]|undefined)=>ids&&ids.length?`LP #${ids.join(', #')}`:'';
export function automationDecisionLabel(decision:DecisionShape|undefined):string{const type=decision?.type;if(!type)return'unbekannt';if(type==='hold')return decision?.reasonCode?`Halten (${decision.reasonCode})`:'Halten';return decisionLabels[type]||type}
export function automationDecisionSummary(decision:DecisionShape|undefined):string{const label=automationDecisionLabel(decision),from=lpList(decision?.fromOfferUrlIds),to=lpList(decision?.toOfferUrlIds);if(!to)return label;return`${label} · ${from?`${from} → ${to}`:to}`}
export function automationCompensationLabel(value:string|undefined):string{return value?compensationLabels[value]||value:'unbekannt'}
export function automationNotice(action:string,payload:unknown):string{
 if(action==='dry_run'||action==='live_run'){const result=(payload&&typeof payload==='object'?payload:{}) as RunPayload,writes=Number(result.writesPerformed)||0;return`${action==='dry_run'?'Dry Run':'Live-Lauf'}: Entscheidung ${automationDecisionLabel(result.evaluation?.action)} · ${writes} Writes`}
 return actionLabels[action]||'Aktion ausgeführt';
}
