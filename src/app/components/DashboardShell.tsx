import {currentUser} from '@/lib/session';
import {can} from '@/lib/rbac';
import {canAccessFraud} from '@/lib/fraud-access';
import AdminSidebar from './AdminSidebar';
import DashboardShellFrame from './DashboardShellFrame';
import OneSignalIdentity from '../settings/app/OneSignalIdentity';
import {loadLeitstandCounters,type LeitstandCounters} from '@/lib/leitstand';

export default async function DashboardShell({children}:{children:React.ReactNode}){
 const oneSignalAppId=process.env.ONESIGNAL_APP_ID||'',oneSignalSafariWebId=process.env.ONESIGNAL_SAFARI_WEB_ID||'',oneSignalConfigured=Boolean(oneSignalAppId),oneSignalEnabled=process.env.ONESIGNAL_ENABLED==='true';
 const user=await currentUser();
 if(!user)return <><OneSignalIdentity enabled={false} appId={oneSignalAppId} safariWebId={oneSignalSafariWebId} externalId=""/>{children}</>;
 const mayAdmin=can(user.access,'users.manage')||can(user.access,'roles.manage')||can(user.access,'audit.view');
 const mayStatistics=can(user.access,'statistics.view')&&can(user.access,'finance.view');
 const capabilities=[can(user.access,'landingpages.manage')&&can(user.access,'api.manage')&&'Sperren',can(user.access,'campaigns.edit')&&can(user.access,'api.manage')&&'Campaigns',can(user.access,'automations.live')&&'Live-Freigabe',can(user.access,'exports.download')&&'Export'].filter((value):value is string=>Boolean(value)),capabilityLabel=capabilities.length?capabilities.join(' · '):'Nur Lesen';
 /** D2: dieselbe Regel wie assertFraudAccess (fraud-access.ts) – kein Sidebar-Eintrag, der in 403 endet. */
 const mayFraud=canAccessFraud(user.access);
 /** Leitstand-Zähler (Sidebar-Badges): nur interne Rollen mit dashboard.view, einmal je Request, gebündelt gecacht; Fehler → keine Zähler (D7: Partner nie). */
 const mayLeitstand=user.access.role!=='partner'&&can(user.access,'dashboard.view');
 let counters:LeitstandCounters|null=null;
 if(mayLeitstand){try{counters=await loadLeitstandCounters()}catch(error){console.error('Leitstand-Zähler nicht ladbar',error)}}
 return <><OneSignalIdentity enabled={oneSignalEnabled} appId={oneSignalAppId} safariWebId={oneSignalSafariWebId} externalId={user.impersonating?'':user.id}/><DashboardShellFrame sidebar={<AdminSidebar
   email={user.email}
   role={user.access.role}
   impersonating={user.impersonating}
   actorId={user.actorId}
   mayStatistics={mayStatistics}
   mayFraud={mayFraud}
   maySettings={user.access.role!=='partner'&&can(user.access,'settings.manage')}
   mayPartners={can(user.access,'partners.view')}
   mayAutomation={user.access.role!=='partner'&&can(user.access,'campaigns.edit')&&can(user.access,'finance.view')}
   maySourceBlocks={user.access.role!=='partner'&&can(user.access,'landingpages.manage')&&can(user.access,'api.manage')}
   maySources={mayLeitstand}
   sourcesBadge={counters?.openKill??null}
   sourceBlocksBadge={counters?.activeBlocks??null}
   maySmartlinks={can(user.access,'smartlinks.view')&&can(user.access,'finance.view')}
   mayAdmin={mayAdmin}
   maySecurity={!user.impersonating&&user.id!=='legacy-admin'}
   oneSignalConfigured={oneSignalConfigured}
   capabilityLabel={capabilityLabel}
   writeAccess={capabilities.length>0}
  />}>
  {children}
 </DashboardShellFrame></>;
}
