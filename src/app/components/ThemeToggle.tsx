'use client';

import{useEffect,useState}from'react';
import{persistTheme,type DashboardTheme}from'../../lib/theme';

export default function ThemeToggle({showLabel=false}:{showLabel?:boolean}){
 const[theme,setTheme]=useState<DashboardTheme|null>(null);
 useEffect(()=>{const current=document.documentElement.dataset.theme;setTheme(current==='light'?'light':'dark')},[]);
 const choose=(next:DashboardTheme)=>{
  setTheme(next);
  try{persistTheme(next,document.documentElement,window.localStorage)}catch{document.documentElement.dataset.theme=next;document.documentElement.style.colorScheme=next}
 };
 const label=theme==='dark'?'Helles Design aktivieren':theme==='light'?'Dunkles Design aktivieren':'Farbschema wechseln';
 const toggle=()=>{const current=theme||(document.documentElement.dataset.theme==='light'?'light':'dark');choose(current==='dark'?'light':'dark')};
 const targetLabel=theme==='dark'?'Hell':theme==='light'?'Dunkel':'Design';
 return <div className="themeHeaderToggle"><button type="button" data-theme-toggle="icon" aria-label={label} aria-pressed={theme==='dark'} title={label} onClick={toggle}><svg className="themeIcon themeIconSun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></svg><svg className="themeIcon themeIconMoon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>{showLabel&&<span className="themeToggleLabel">{targetLabel}</span>}</button></div>;
}
