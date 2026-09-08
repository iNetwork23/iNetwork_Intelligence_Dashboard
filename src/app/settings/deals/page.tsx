import LocalizedMain from '../../components/LocalizedMain';
import{redirect}from'next/navigation';
import{currentUser}from'@/lib/session';
import{can}from'@/lib/rbac';
import{DEFAULT_DEAL_RULES,type DealRegisterState}from'@/lib/deal-register';
import{readEditableDealRegister}from'@/lib/deal-register-store';
import DashboardPageHeader from'../../components/DashboardPageHeader';
import AccessDeniedHint from'../../components/AccessDeniedHint';
import DealRegisterForm from'./DealRegisterForm';
export const dynamic='force-dynamic';
/** Deal-Register (D9): Konfiguration nur mit settings.manage; Partner sehen nichts Neues (D7). */
export default async function DealSettingsPage(){
 const user=await currentUser();if(!user)redirect('/login');
 if(user.access.role==='partner'||!can(user.access,'settings.manage'))return <LocalizedMain className="fatal"><h1>403 · Keine Berechtigung</h1><AccessDeniedHint permission="settings.manage"/></LocalizedMain>;
 let state:DealRegisterState={rules:DEFAULT_DEAL_RULES.map(rule=>({...rule})),source:'defaults'},loadError='',revision:string|undefined;
 try{const loaded=await readEditableDealRegister();state=loaded;revision=loaded.revision}catch(error){console.error('Deal register could not be loaded',error);loadError='Deal-Register konnte nicht geladen werden – angezeigt werden die Standardregeln. Speichern ist bis zum erfolgreichen Neuladen gesperrt.'}
 return <LocalizedMain className="dashboard dealRegisterPage">
  <DashboardPageHeader kicker="Einstellungen · Sonderdeals" title="Deal-Register" status={state.source==='stored'?`${state.rules.length} ${state.rules.length===1?'Regel':'Regeln'} gespeichert`:'Standardregeln'} tone="neutral" icon="smartlink" description="Partnerspezifische Testquoten, Reifefenster und CVR-Untergrenzen für Smartlink-Empfehlungen und Auto-Rotation. Ohne gespeichertes Register gelten die bisherigen Sonderdeal-Konstanten; ohne Regel für einen Partner die allgemeinen Schwellen der Engine."/>
  <DealRegisterForm initialRevision={revision} initialRules={state.rules} initialSource={state.source} defaults={DEFAULT_DEAL_RULES} loadError={loadError||undefined}/>
 </LocalizedMain>;
}
