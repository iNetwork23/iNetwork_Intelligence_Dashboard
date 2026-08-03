import {currentUser} from '@/lib/session';
import {can} from '@/lib/rbac';
import AdminSidebar from './AdminSidebar';
import DashboardShellFrame from './DashboardShellFrame';
import OneSignalIdentity from '../settings/app/OneSignalIdentity';

export default async function DashboardShell({children}:{children:React.ReactNode}){
 const user=await currentUser();
 if(!user)return children;
 const mayAdmin=can(user.access,'users.manage')||can(user.access,'roles.manage')||can(user.access,'audit.view');
 const mayFraud=user.access.role==='super_admin'&&Object.values(user.access.scopes).every(values=>values.length===0)&&can(user.access,'statistics.view')&&can(user.access,'finance.view');
 const oneSignalAppId=process.env.ONESIGNAL_APP_ID||'',oneSignalConfigured=Boolean(oneSignalAppId),oneSignalEnabled=process.env.ONESIGNAL_ENABLED==='true';
 return <><OneSignalIdentity enabled={oneSignalEnabled} appId={oneSignalAppId} safariWebId={process.env.ONESIGNAL_SAFARI_WEB_ID||''} externalId={user.impersonating?'':user.id}/><DashboardShellFrame sidebar={<AdminSidebar
   email={user.email}
   role={user.access.role}
   impersonating={user.impersonating}
   actorId={user.actorId}
   mayStatistics={can(user.access,'statistics.view')}
   mayFraud={mayFraud}
   mayPartners={can(user.access,'partners.view')}
   mayAutomation={user.access.role!=='partner'&&can(user.access,'campaigns.edit')&&can(user.access,'finance.view')}
   maySourceBlocks={user.access.role!=='partner'&&can(user.access,'landingpages.manage')&&can(user.access,'api.manage')}
   maySmartlinks={can(user.access,'smartlinks.view')&&can(user.access,'finance.view')}
   mayAdmin={mayAdmin}
   maySecurity={!user.impersonating&&user.id!=='legacy-admin'}
   oneSignalConfigured={oneSignalConfigured}
  />}>
  {children}
 </DashboardShellFrame></>;
}
