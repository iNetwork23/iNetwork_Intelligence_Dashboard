"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useState} from "react";
import {moveSidebarItem,moveSidebarItemByVisibleOrder,parseSidebarOrder} from "@/lib/sidebar-order";
import ThemeToggle from "./ThemeToggle";
import LanguageToggle from "./LanguageToggle";
import OneSignalLogoutForm from "./OneSignalLogoutForm";

type Props={
 email:string;
 role:string;
 impersonating:boolean;
 actorId:string;
 mayStatistics:boolean;
 mayFraud:boolean;
 mayPartners:boolean;
 mayAutomation:boolean;
 maySourceBlocks:boolean;
 maySmartlinks:boolean;
 mayAdmin:boolean;
 maySecurity:boolean;
 oneSignalConfigured:boolean;
 capabilityLabel:string;
 writeAccess:boolean;
};
type IconName="monitor"|"chart"|"users"|"rotation"|"spark"|"shield"|"lock";
type PrimaryItem={href:string;label:string;icon:IconName;show:boolean};
const PRIMARY_ROUTES=["/","/cohorts","/fraud","/affiliates","/automation"];
const icons:Record<IconName,React.ReactNode>={
 monitor:<><rect x="3" y="4" width="18" height="15" rx="2"/><path d="M8 22h8M12 19v3M7 9h3v6H7zm7-2h3v8h-3z"/></>,
 chart:<><path d="M4 19V9m6 10V5m6 14v-7m4 9H2"/></>,
 users:<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
 rotation:<><path d="M20 7h-6V1M4 17h6v6M20 7a9 9 0 0 0-15.5-3M4 17a9 9 0 0 0 15.5 3"/></>,
 spark:<><path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3zm7 11 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14zM5 14l1.1 2.9L9 18l-2.9 1.1L5 22l-1.1-2.9L1 18l2.9-1.1L5 14z"/></>,
 shield:<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></>,
 lock:<><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
};
function Icon({name}:{name:IconName}){return <svg className="sidebarIcon" viewBox="0 0 24 24" aria-hidden="true">{icons[name]}</svg>}
function PencilIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="m14 7 3 3"/></svg>}
function GripIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="6" r="1"/><circle cx="16" cy="6" r="1"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="8" cy="18" r="1"/><circle cx="16" cy="18" r="1"/></svg>}
function ArrowIcon({direction}:{direction:"up"|"down"}){return <svg viewBox="0 0 24 24" aria-hidden="true" className={direction}><path d="m7 14 5-5 5 5"/></svg>}

export default function AdminSidebar(props:Props){
 const pathname=usePathname(),storageKey=`wlx-sidebar-order:${props.email.trim().toLowerCase()}`;
 const[collapsed,setCollapsed]=useState(false),[mobileOpen,setMobileOpen]=useState(false),[editing,setEditing]=useState(false),[order,setOrder]=useState<string[]>(PRIMARY_ROUTES),[dragging,setDragging]=useState<string|null>(null),[announcement,setAnnouncement]=useState("");
 useEffect(()=>{const saved=window.localStorage.getItem("wlx-sidebar-collapsed")==="1";setCollapsed(saved);document.documentElement.dataset.sidebarCollapsed=saved?"true":"false"},[]);
 useEffect(()=>setOrder(parseSidebarOrder(window.localStorage.getItem(storageKey),PRIMARY_ROUTES)),[storageKey]);
 useEffect(()=>{setMobileOpen(false)},[pathname]);
 useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape"){setMobileOpen(false);setEditing(false)}};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[]);
 const toggleCollapsed=()=>setCollapsed(current=>{const next=!current;window.localStorage.setItem("wlx-sidebar-collapsed",next?"1":"0");document.documentElement.dataset.sidebarCollapsed=next?"true":"false";return next});
 const items:PrimaryItem[]=[
  {href:"/",label:"Account Monitor",icon:"monitor",show:true},
  {href:"/cohorts",label:"LTV-Kohorten",icon:"chart",show:props.mayStatistics},
  {href:"/fraud",label:"Fraud Detection",icon:"shield",show:props.mayFraud},
  {href:"/affiliates",label:"Affiliate Optimizer",icon:"users",show:props.mayPartners||props.maySmartlinks},
  {href:"/automation",label:"Auto-Rotation",icon:"rotation",show:props.mayAutomation},

 ];
 const secondary=[
  {href:"/admin/access",label:"Benutzer & Rechte",icon:"shield" as const,show:props.mayAdmin},
  {href:"/source-blocks",label:"Ausgeschaltete Quellen",icon:"rotation" as const,show:props.maySourceBlocks},
  {href:"/settings/app",label:"App & Hinweise",icon:"monitor" as const,show:!props.impersonating},
  {href:"/settings/security",label:"Sicherheit",icon:"lock" as const,show:props.maySecurity},
 ];
 const active=(href:string)=>href==="/"?pathname===href:pathname.startsWith(href);
 const orderedItems=[...items].sort((a,b)=>order.indexOf(a.href)-order.indexOf(b.href)),visibleItems=orderedItems.filter(item=>item.show),visibleRoutes=visibleItems.map(item=>item.href);
 const commitOrder=(next:string[],movedHref:string)=>{setOrder(next);window.localStorage.setItem(storageKey,JSON.stringify(next));const item=items.find(candidate=>candidate.href===movedHref),position=next.filter(href=>visibleRoutes.includes(href)).indexOf(movedHref)+1;setAnnouncement(`${item?.label||"Bereich"} ist jetzt an Position ${position}`)};
 const moveBy=(href:string,direction:-1|1)=>commitOrder(moveSidebarItemByVisibleOrder(order,visibleRoutes,href,direction),href);
 const dropOn=(target:string)=>{if(dragging&&dragging!==target)commitOrder(moveSidebarItem(order,dragging,target),dragging);setDragging(null)};
 const toggleEditing=()=>{if(!editing&&collapsed){setCollapsed(false);window.localStorage.setItem("wlx-sidebar-collapsed","0");document.documentElement.dataset.sidebarCollapsed="false"}setEditing(current=>!current)};
 return <>
  <button className="mobileSidebarToggle" type="button" aria-label="Navigation öffnen" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(true)}><span/><span/><span/></button>
  <button className={`sidebarBackdrop ${mobileOpen?"visible":""}`} type="button" aria-label="Navigation schließen" onClick={()=>setMobileOpen(false)}/>
  <aside className={`adminSidebar ${mobileOpen?"mobileOpen":""} ${editing?"ordering":""}`} data-sidebar-collapsed={collapsed} aria-label="Hauptnavigation">
   <div className="sidebarBrand"><span className="brandMark">ME</span><div><strong>ME Media</strong><small>Performance Intelligence</small></div><button type="button" className="sidebarCollapse" aria-label={collapsed?"Seitenleiste ausklappen":"Seitenleiste einklappen"} aria-expanded={!collapsed} onClick={toggleCollapsed}>‹</button></div>
   <div className="sidebarWorkspace"><span className="workspaceAvatar">{props.email.slice(0,1).toUpperCase()}</span><div><small>Angemeldet als</small><strong>{props.email}</strong></div></div>
   {props.impersonating&&<div className="sidebarImpersonation"><strong>Impersonation aktiv</strong><small>Akteur {props.actorId}</small><form action="/api/auth/impersonation/exit" method="post"><button>Verlassen</button></form></div>}
   <div className="sidebarNavHeader"><span>Bereiche</span><button type="button" className={editing?"active":""} aria-pressed={editing} onClick={toggleEditing}><PencilIcon/><span>{editing?"Fertig":"Bearbeiten"}</span></button></div>
   <nav className="sidebarNav" aria-label="Dashboard-Bereiche">
    {editing?<div className="sidebarOrderList" role="list">{visibleItems.map((item,index)=><div key={item.href} role="listitem" className={`sidebarOrderItem ${active(item.href)?"active":""} ${dragging===item.href?"dragging":""}`} draggable onDragStart={event=>{event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",item.href);setDragging(item.href)}} onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect="move"}} onDrop={event=>{event.preventDefault();dropOn(item.href)}} onDragEnd={()=>setDragging(null)}>
      <span className="sidebarDragHandle" title="Ziehen, um die Reihenfolge zu ändern"><GripIcon/></span><Icon name={item.icon}/><span className="sidebarOrderLabel">{item.label}</span><span className="sidebarOrderControls"><button type="button" disabled={index===0} aria-label={`${item.label} nach oben`} onClick={()=>moveBy(item.href,-1)}><ArrowIcon direction="up"/></button><button type="button" disabled={index===visibleItems.length-1} aria-label={`${item.label} nach unten`} onClick={()=>moveBy(item.href,1)}><ArrowIcon direction="down"/></button></span>
     </div>)}</div>:visibleItems.map(item=><Link key={item.href} href={item.href} prefetch={false} className={active(item.href)?"active":""} aria-current={active(item.href)?"page":undefined} title={collapsed?item.label:undefined}><Icon name={item.icon}/><span>{item.label}</span></Link>)}
   </nav>
   <span className="sidebarOrderAnnouncement" aria-live="polite">{announcement}</span>
   <nav className="sidebarNav sidebarSecondary" aria-label="Verwaltung">{secondary.filter(item=>item.show).map(item=><Link key={item.href} href={item.href} prefetch={false} className={active(item.href)?"active":""} aria-current={active(item.href)?"page":undefined} title={collapsed?item.label:undefined}><Icon name={item.icon}/><span>{item.label}</span></Link>)}</nav>
   <div className="sidebarFooter"><div className="sidebarStatus"><i className={props.writeAccess?"write":"read"}/><span>{props.capabilityLabel}</span><small>{props.role.replaceAll("_"," ")}</small></div><div className="sidebarActions"><div className="sidebarPreferences"><div className="sidebarPreference"><span>Sprache</span><LanguageToggle compact/></div><div className="sidebarPreference"><span>Darstellung</span><ThemeToggle showLabel/></div></div><OneSignalLogoutForm configured={props.oneSignalConfigured}/></div></div>
  </aside>
 </>
}
