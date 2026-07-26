'use client';

import{useEffect,useState}from'react';
import{persistTheme,type DashboardTheme}from'../../lib/theme';

export default function ThemeToggle(){
 const[theme,setTheme]=useState<DashboardTheme|null>(null);
 useEffect(()=>{const current=document.documentElement.dataset.theme;setTheme(current==='light'?'light':'dark')},[]);
 const choose=(next:DashboardTheme)=>{
  setTheme(next);
  try{persistTheme(next,document.documentElement,window.localStorage)}catch{document.documentElement.dataset.theme=next;document.documentElement.style.colorScheme=next}
 };
 return <div className="themeSwitcher" role="group" aria-label="Farbschema wählen"><span>Darstellung</span><button type="button" data-theme-option="light" aria-pressed={theme==='light'} onClick={()=>choose('light')}>Hell</button><button type="button" data-theme-option="dark" aria-pressed={theme==='dark'} onClick={()=>choose('dark')}>Dunkel</button></div>;
}
