'use client';

import {useLanguage} from './LanguageProvider';

export default function LanguageToggle({compact=false}:{compact?:boolean}){
 const{locale,setLocale}=useLanguage();
 const label=locale==='de'?'Sprache auswählen':'Select language';
 return <div className={`languageToggle ${compact?'compact':''}`} role="group" aria-label={label} data-no-translate>
  <button type="button" lang="de" aria-label="Deutsch" aria-pressed={locale==='de'} onClick={()=>setLocale('de')}>DE</button>
  <button type="button" lang="en" aria-label="English" aria-pressed={locale==='en'} onClick={()=>setLocale('en')}>EN</button>
 </div>;
}
