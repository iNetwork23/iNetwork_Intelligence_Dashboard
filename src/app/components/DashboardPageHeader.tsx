import type {ReactNode} from 'react';

type HeaderIcon="monitor"|"affiliate"|"smartlink"|"automation"|"cohorts"|"access"|"security";
type HeaderStatusTone='live'|'neutral'|'protected';

const icons:Record<HeaderIcon,ReactNode>={
 monitor:<><path d="M4 5.5h16v11H4z"/><path d="M8 20h8M12 16.5V20M7 12l3-3 2.5 2.5L17 7"/></>,
 affiliate:<><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M16 8h5M18.5 5.5v5"/></>,
 smartlink:<><path d="M9.5 14.5l5-5M7.2 16.8l-1.4 1.4a3.5 3.5 0 01-5-5l3-3a3.5 3.5 0 015 0M16.8 7.2l1.4-1.4a3.5 3.5 0 015 5l-3 3a3.5 3.5 0 01-5 0"/></>,
 automation:<><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="4"/><path d="M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></>,
 cohorts:<><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,
 access:<><circle cx="8" cy="8" r="3"/><path d="M2.5 19c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M17 10v8M14 14h6"/></>,
 security:<><path d="M12 3l7 3v5c0 4.7-2.7 8-7 10-4.3-2-7-5.3-7-10V6z"/><path d="M9 12l2 2 4-4"/></>,
};

export default function DashboardPageHeader({kicker,title,description,status,icon,tone='neutral'}:{kicker:string;title:string;description:string;status?:string;icon:HeaderIcon;tone?:HeaderStatusTone}){
 return <header className="dashboardPageHeader">
  <div className="dashboardPageIcon" aria-hidden="true"><svg viewBox="0 0 24 24">{icons[icon]}</svg></div>
  <div className="dashboardPageCopy">
   <div className="dashboardPageKicker">{kicker}</div>
   <div className="dashboardPageTitle"><h1>{title}</h1>{status&&<span className={`dashboardPageStatus ${tone}`}><i/>{status}</span>}</div>
   <p className="dashboardPageDescription">{description}</p>
  </div>
 </header>
}
