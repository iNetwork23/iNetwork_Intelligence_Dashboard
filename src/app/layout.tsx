import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'WLX Performance Monitor',description:'Offer 57 Smartlink Performance'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="de"><body>{children}</body></html>}
