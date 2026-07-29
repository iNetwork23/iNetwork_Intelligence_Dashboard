"use client";

import {usePathname} from "next/navigation";

export default function DashboardShellFrame({sidebar,children}:{sidebar:React.ReactNode;children:React.ReactNode}){
 const pathname=usePathname();
 if(pathname==="/login")return children;
 return <div className="adminShell">{sidebar}<div className="adminContent">{children}</div></div>;
}
