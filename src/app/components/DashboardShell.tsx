import {currentUser} from '@/lib/session';
import {can} from '@/lib/rbac';
import AdminSidebar from './AdminSidebar';
import DashboardShellFrame from './DashboardShellFrame';

export default async function DashboardShell({children}:{children:React.ReactNode}){
 const user=await currentUser();
 if(!user)return children;
 const mayAdmin=can(user.access,'users.manage')||can(user.access,'roles.manage')||can(user.access,'audit.view');
 return <DashboardShellFrame sidebar={<AdminSidebar
   email={user.email}
   role={user.access.role}
   impersonating={user.impersonating}
   actorId={user.actorId}
   mayStatistics={can(user.access,'statistics.view')}
   mayPartners={can(user.access,'partners.view')}
   mayAutomation={user.access.role!=='partner'&&can(user.access,'campaigns.edit')&&can(user.access,'finance.view')}
   maySourceBlocks={user.access.role!=='partner'&&can(user.access,'landingpages.manage')&&can(user.access,'api.manage')}
   maySmartlinks={can(user.access,'smartlinks.view')&&can(user.access,'finance.view')}
   mayAdmin={mayAdmin}
   maySecurity={!user.impersonating&&user.id!=='legacy-admin'}
  />}>
  {children}
 </DashboardShellFrame>;
}
