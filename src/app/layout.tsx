import type{Metadata}from'next';

import{themeBootScript}from'../lib/theme';
import'./globals.css';
import DashboardShell from'./components/DashboardShell';

export const metadata:Metadata={title:'ME Media Performance Intelligence',description:'Accountweite Everflow- und Smartlink-Business-Intelligence'};

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="de" suppressHydrationWarning><head><script id="theme-init" dangerouslySetInnerHTML={{__html:themeBootScript()}}/></head><body><DashboardShell>{children}</DashboardShell></body></html>;
}
