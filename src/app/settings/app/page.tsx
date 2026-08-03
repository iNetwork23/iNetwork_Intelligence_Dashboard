import{redirect}from'next/navigation';
import{currentUser}from'@/lib/session';
import DashboardPageHeader from'../../components/DashboardPageHeader';
import AppInstallation from'./AppInstallation';
import OneSignalIdentity from'./OneSignalIdentity';

export const dynamic='force-dynamic';

export default async function AppSettingsPage(){
 const user=await currentUser();
 if(!user)redirect('/login');
 const enabled=process.env.ONESIGNAL_ENABLED==='true',externalId=user.impersonating?'':user.id;
 return <main className="dashboard appSettingsPage">
  <OneSignalIdentity enabled={enabled} appId={process.env.ONESIGNAL_APP_ID||''} safariWebId={process.env.ONESIGNAL_SAFARI_WEB_ID||''} externalId={externalId}/>
  <DashboardPageHeader kicker="Einstellungen · App" title="App & Benachrichtigungen" status="Installierbar" tone="live" icon="security" description="Dashboard ohne App Store auf Desktop und Mobilgerät installieren und Push-Benachrichtigungen je Gerät aktivieren."/>
  <AppInstallation/>
 </main>;
}
