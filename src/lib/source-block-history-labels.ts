import type{SourceBlockHistoryAction}from'./source-block-history';
/** Anzeigetexte der Sperr-Historie (client-sicher, keine Store-Importe). */
export const SOURCE_BLOCK_HISTORY_ACTION_LABELS:Record<SourceBlockHistoryAction,string>={activate:'Gesperrt',activate_across_offers:'Produktweit gesperrt',deactivate:'Wieder aktiviert',activate_failed:'Sperre fehlgeschlagen',deactivate_failed:'Reaktivierung fehlgeschlagen',reconcile_ok:'Abgleich bestätigt',reconcile_mismatch:'Abgleich abweichend'};
export const sourceBlockHistoryActionLabel=(action:string)=>(SOURCE_BLOCK_HISTORY_ACTION_LABELS as Record<string,string>)[action]??action;
