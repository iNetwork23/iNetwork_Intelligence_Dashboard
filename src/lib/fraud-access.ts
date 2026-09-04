import{can,type AccessMetadata}from'./rbac';
/**
 * D2: Fraud-Signale und Sperre gehören zusammen. Eine Regel für Service-Gate, Seiten-Gate und Sidebar (kein 403-Sidebar-Eintrag, Abnahme G).
 * Interne Rolle (≠ partner), UNGESCOPT (die Fraud-Aggregation ist accountweit), landingpages.manage UND api.manage (Sperr-Rechte) UND statistics.view.
 * finance.view gehört nicht zum Gate – es steuert nur die Geldspalten. Client-sicher, reine Funktion.
 */
export const FRAUD_ACCESS_HINT='statistics.view, landingpages.manage und api.manage als interne Rolle ohne Scopes';
export const isUnscopedAccess=(access:AccessMetadata)=>Object.values(access.scopes).every(values=>values.length===0);
export const canAccessFraud=(access:AccessMetadata)=>access.role!=='partner'&&isUnscopedAccess(access)&&can(access,'statistics.view')&&can(access,'landingpages.manage')&&can(access,'api.manage');
