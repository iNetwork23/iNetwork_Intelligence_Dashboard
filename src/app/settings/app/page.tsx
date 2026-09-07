import LocalizedMain from '../../components/LocalizedMain';
import{redirect}from'next/navigation';
import{currentUser}from'@/lib/session';
import DashboardPageHeader from'../../components/DashboardPageHeader';
import AppInstallation from'./AppInstallation';


export const dynamic='force-dynamic';

export default async function AppSettingsPage(){
 const user=await currentUser();
 if(!user)redirect('/login');
 return <LocalizedMain className="dashboard appSettingsPage">
  <DashboardPageHeader kicker="Einstellungen · App" title="App & Benachrichtigungen" status="Installierbar" tone="live" icon="security" description="Dashboard ohne App Store auf Desktop und Mobilgerät installieren und Push-Benachrichtigungen je Gerät aktivieren."/>
  <AppInstallation/>
 </LocalizedMain>;
}
