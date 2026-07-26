export type DashboardTheme='light'|'dark';
export const THEME_STORAGE_KEY='wlx-theme';

export function resolveTheme(stored:string|null,prefersDark:boolean):DashboardTheme{
 if(stored==='light'||stored==='dark')return stored;
 return prefersDark?'dark':'light';
}

export function persistTheme(theme:DashboardTheme,root:{dataset:{theme?:string};style:{colorScheme:string}},storage:{setItem:(key:string,value:string)=>unknown}){
 root.dataset.theme=theme;
 root.style.colorScheme=theme;
 storage.setItem(THEME_STORAGE_KEY,theme);
}

export function themeBootScript(){
 return `(function(){var s=null,d=false;try{s=window.localStorage.getItem('${THEME_STORAGE_KEY}')}catch(e){}try{d=window.matchMedia('(prefers-color-scheme: dark)').matches}catch(e){}var t=s==='light'||s==='dark'?s:(d?'dark':'light');var r=document.documentElement;r.dataset.theme=t;r.style.colorScheme=t})()`;
}
