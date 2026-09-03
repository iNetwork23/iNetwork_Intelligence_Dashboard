'use client';
import{useEffect,useMemo,useState,useTransition,type FormEvent}from'react';
import{usePathname,useRouter,useSearchParams}from'next/navigation';
import type{ReportingPeriod}from'@/lib/supabase-reporting';
import{dashboardMonthOptions}from'@/lib/dashboard-months';
const presets=[['today','Heute'],['7d','7 Tage'],['30d','30 Tage'],['90d','90 Tage'],['12m','12 Monate'],['all','365 Tage']]as const;
type Panel='months'|'custom'|null;
export default function DashboardPeriodControls({period,rangeLabel,maxDate,from,to}:{period:ReportingPeriod;rangeLabel:string;maxDate:string;from?:string;to?:string}){
 const router=useRouter(),pathname=usePathname(),searchParams=useSearchParams(),[pending,startTransition]=useTransition(),maxYear=Number(maxDate.slice(0,4));
 const initialYear=period==='custom'&&from?.slice(0,4)||String(maxYear),[year,setYear]=useState(initialYear),options=useMemo(()=>dashboardMonthOptions(year,maxDate),[year,maxDate]);
 const selectedYear=period==='custom'&&from?from.slice(0,4):null,selectedOptions=selectedYear?dashboardMonthOptions(selectedYear,maxDate):[],selectedMonth=period==='custom'?selectedOptions.find(month=>month.range?.from===from&&month.range?.to===to)?.id:null;
 const[panel,setPanel]=useState<Panel>(selectedMonth?'months':period==='custom'?'custom':null),[customFrom,setCustomFrom]=useState(from??''),[customTo,setCustomTo]=useState(to??''),years=Array.from({length:11},(_,index)=>String(maxYear-index));
 useEffect(()=>{setCustomFrom(from??'');setCustomTo(to??'');if(period!=='custom'){setPanel(null);return}if(selectedMonth&&selectedYear){setYear(selectedYear);setPanel('months')}else setPanel('custom')},[period,from,to,selectedMonth,selectedYear]);
 const navigate=(next:Record<string,string>)=>{const params=new URLSearchParams(searchParams);for(const key of['period','from','to'])params.delete(key);for(const[key,value]of Object.entries(next))params.set(key,value);startTransition(()=>router.push(`${pathname}?${params}`,{scroll:false}))};
 const choosePreset=(next:ReportingPeriod)=>{setPanel(null);navigate({period:next})};
 const chooseMonth=(month:string)=>{const range=options.find(item=>item.id===month)?.range;if(!range)return;setPanel('months');navigate({period:'custom',...range})};
 const submitCustom=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();navigate({period:'custom',from:customFrom,to:customTo})};
 return <section className="dashboardPeriod" aria-busy={pending}>
  <header><div><span>BERICHTSZEITRAUM</span><b>{rangeLabel}</b></div><small>Berlin</small></header>
  <div className="dashboardPeriodToolbar">
   <div className="dashboardPresetButtons" role="group" aria-label="Schnelle Zeiträume">{presets.map(([id,label])=><button type="button" key={id} className={period===id?'active':''} aria-pressed={period===id} disabled={pending} onClick={()=>choosePreset(id)}>{label}</button>)}</div>
   <div className="dashboardPeriodModes" role="group" aria-label="Zeitraum genauer auswählen"><button type="button" className={panel==='months'?'active':''} aria-expanded={panel==='months'} onClick={()=>setPanel(value=>value==='months'?null:'months')}><span aria-hidden="true">▦</span>Monat wählen</button><button type="button" className={panel==='custom'?'active':''} aria-expanded={panel==='custom'} onClick={()=>setPanel(value=>value==='custom'?null:'custom')}><span aria-hidden="true">↔</span>Individuell</button></div>
  </div>
  {panel==='months'&&<div className="dashboardMonthPicker">
   <div className="dashboardMonthYear"><button type="button" aria-label="Vorheriges Jahr" disabled={Number(year)<=maxYear-10||pending} onClick={()=>setYear(String(Number(year)-1))}>‹</button><label>Jahr<select value={year} onChange={event=>setYear(event.target.value)}>{years.map(value=><option key={value}>{value}</option>)}</select></label><button type="button" aria-label="Nächstes Jahr" disabled={Number(year)>=maxYear||pending} onClick={()=>setYear(String(Number(year)+1))}>›</button></div>
   <div className="dashboardMonthGrid" role="group" aria-label={`Monate ${year}`}>{options.map(month=><button type="button" key={month.id} disabled={month.disabled||pending} className={selectedMonth===month.id&&from?.startsWith(year)?'active':''} aria-pressed={selectedMonth===month.id&&from?.startsWith(year)} onClick={()=>chooseMonth(month.id)}><b>{month.label}</b><small>{month.range?`${month.range.from.slice(8,10)}.${month.range.from.slice(5,7)}.–${month.range.to.slice(8,10)}.${month.range.to.slice(5,7)}.`:'Noch nicht verfügbar'}</small></button>)}</div>
  </div>}
  {panel==='custom'&&<form className="dashboardCustomPeriod" onSubmit={submitCustom}><div><strong>Freier Zeitraum</strong><small>Start- und Enddatum festlegen</small></div><label>Von<input required type="date" name="from" max={maxDate} value={customFrom} onChange={event=>setCustomFrom(event.target.value)}/></label><label>Bis<input required type="date" name="to" max={maxDate} value={customTo} onChange={event=>setCustomTo(event.target.value)}/></label><button type="submit" disabled={pending}>Anwenden</button></form>}
  {pending&&<span className="dashboardPeriodPending" role="status"><i/>Zeitraum wird geladen …</span>}
 </section>
}
