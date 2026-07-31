import type{Metadata}from'next';

import{themeBootScript}from'../lib/theme';
import{localeBootScript}from'../lib/i18n';
import'./globals.css';
import DashboardShell from'./components/DashboardShell';
import LanguageProvider from'./components/LanguageProvider';
import PwaRegistration from'./components/PwaRegistration';

export const metadata:Metadata={title:'ME Media Performance Intelligence',description:'Accountweite Everflow- und Smartlink-Business-Intelligence',manifest:'/manifest.webmanifest',applicationName:'ME Media',appleWebApp:{capable:true,statusBarStyle:'black-translucent',title:'ME Media'},icons:{icon:[{url:'/icons/app-192.png',sizes:'192x192',type:'image/png'}],apple:'/icons/apple-touch-180.png'}};

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="de" suppressHydrationWarning><head><meta name="theme-color" content="#0b1728"/><script id="theme-init" dangerouslySetInnerHTML={{__html:themeBootScript()}}/><script id="locale-init" dangerouslySetInnerHTML={{__html:localeBootScript()}}/></head><body><PwaRegistration/><LanguageProvider><DashboardShell>{children}</DashboardShell></LanguageProvider></body></html>;
}
