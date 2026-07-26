import type{Metadata}from'next';
import ThemeToggle from'./components/ThemeToggle';
import{themeBootScript}from'../lib/theme';
import'./globals.css';

export const metadata:Metadata={title:'ME Media Performance Intelligence',description:'Accountweite Everflow- und Smartlink-Business-Intelligence'};

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="de" suppressHydrationWarning><head><script id="theme-init" dangerouslySetInnerHTML={{__html:themeBootScript()}}/></head><body><ThemeToggle/>{children}</body></html>;
}
