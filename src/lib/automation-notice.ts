export type AutomationNoticeTone='ok'|'error'|'info';
export type AutomationNotice={tone:AutomationNoticeTone;text:string};
type DecisionShape={type?:string;reasonCode?:string};
type RunPayload={evaluation?:{action?:DecisionShape};writesPerformed?:number};
const decisionLabels:Record<string,string>={replace_slot:'Slot ersetzt',rotate_round:'Runde rotiert',promote:'Champion gesetzt'};
const actionLabels:Record<string,string>={create:'Entwurf gespeichert',update:'Konfiguration aktualisiert',request_live:'Live angefordert',activate_live:'Live aktiviert',pause:'Pausiert',resume:'Fortgesetzt',complete:'Beendet',import_legacy:'Als Entwurf importiert'};
export function automationDecisionLabel(decision:DecisionShape|undefined):string{const type=decision?.type;if(!type)return'unbekannt';if(type==='hold')return decision?.reasonCode?`Halten (${decision.reasonCode})`:'Halten';return decisionLabels[type]||type}
export function automationNotice(action:string,payload:unknown):string{
 if(action==='dry_run'||action==='live_run'){const result=(payload&&typeof payload==='object'?payload:{}) as RunPayload,writes=Number(result.writesPerformed)||0;return`${action==='dry_run'?'Dry Run':'Live-Lauf'}: Entscheidung ${automationDecisionLabel(result.evaluation?.action)} · ${writes} Writes`}
 return actionLabels[action]||'Aktion ausgeführt';
}
