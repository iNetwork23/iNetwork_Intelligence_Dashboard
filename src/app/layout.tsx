import type{Metadata}from'next';

import{themeBootScript}from'../lib/theme';
import{localeBootScript}from'../lib/i18n';
import'./globals.css';
import DashboardShell from'./components/DashboardShell';
import LanguageProvider from'./components/LanguageProvider';

export const metadata:Metadata={title:'ME Media Performance Intelligence',description:'Accountweite Everflow- und Smartlink-Business-Intelligence'};

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="de" suppressHydrationWarning><head><script id="theme-init" dangerouslySetInnerHTML={{__html:themeBootScript()}}/><script id="locale-init" dangerouslySetInnerHTML={{__html:localeBootScript()}}/></head><body><LanguageProvider><DashboardShell>{children}</DashboardShell></LanguageProvider></body></html>;
}
