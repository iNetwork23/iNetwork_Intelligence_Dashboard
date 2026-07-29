'use client';
import{useEffect,useState,useTransition,type FormEvent}from'react';
import{usePathname,useRouter,useSearchParams}from'next/navigation';
import{AFFILIATE_PERIODS,type ResolvedAffiliatePeriod}from'@/lib/affiliate-period';
const presets=AFFILIATE_PERIODS.filter(([id])=>id!=='custom');
const months=[['01','Januar'],['02','Februar'],['03','März'],['04','April'],['05','Mai'],['06','Juni'],['07','Juli'],['08','August'],['09','September'],['10','Oktober'],['11','November'],['12','Dezember']] as const;
type Editor='calendar'|'custom'|null;
export default function AffiliatePeriodControls({period}:{period:ResolvedAffiliatePeriod}){
 const router=useRouter(),pathname=usePathname(),searchParams=useSearchParams(),[pending,startTransition]=useTransition(),maxYear=Number(period.maxDate.slice(0,4)),maxMonth=period.maxDate.slice(5,7),resolvedEditor:Editor=period.period==='calendar'?'calendar':period.period==='custom'?'custom':null;
 const[panel,setPanel]=useState<Editor>(resolvedEditor),[year,setYear]=useState(period.period==='calendar'?period.from.slice(0,4):String(maxYear)),[month,setMonth]=useState(period.period==='calendar'&&period.from.slice(0,7)===period.to.slice(0,7)?period.from.slice(5,7):'all');
 useEffect(()=>{setPanel(resolvedEditor);if(period.period==='calendar'){setYear(period.from.slice(0,4));setMonth(period.from.slice(0,7)===period.to.slice(0,7)?period.from.slice(5,7):'all')}},[period.period,period.from,period.to,resolvedEditor]);
 const years=Array.from({length:11},(_,index)=>String(maxYear-index)),visibleMonths=months.filter(([id])=>year!==String(maxYear)||id<=maxMonth);
 const navigate=(next:Record<string,string>)=>{const params=new URLSearchParams(searchParams);for(const key of['period','from','to','calendarYear','calendarMonth'])params.delete(key);for(const[key,value]of Object.entries(next))params.set(key,value);startTransition(()=>router.push(`${pathname}?${params}`,{scroll:false}))};
 const choosePreset=(id:string)=>{setPanel(null);navigate({period:id})},choosePanel=(next:Exclude<Editor,null>)=>setPanel(value=>value===next?null:next),chooseYear=(next:string)=>{setYear(next);if(next===String(maxYear)&&month!=='all'&&month>maxMonth)setMonth('all')};
 const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(panel==='calendar')navigate({period:'calendar',calendarYear:year,calendarMonth:month});else if(panel==='custom'){const data=new FormData(event.currentTarget);navigate({period:'custom',from:String(data.get('from')||''),to:String(data.get('to')||'')})}};
 return <div className="affiliatePeriodControls" aria-busy={pending}>
  <div className="affiliatePeriodToolbar">
   <div className="affiliatePresetButtons" role="group" aria-label="Schnelle Zeiträume">{presets.map(([id,label])=><button type="button" key={id} className={period.period===id?'active':''} aria-pressed={period.period===id} disabled={pending} onClick={()=>choosePreset(id)}>{label}</button>)}</div>
   <div className="affiliateEditorModes" role="group" aria-label="Kalenderzeitraum festlegen"><button type="button" className={panel==='calendar'?'active':''} aria-expanded={panel==='calendar'} onClick={()=>choosePanel('calendar')}><span aria-hidden="true">▦</span>Jahr / Monat</button><button type="button" className={panel==='custom'?'active':''} aria-expanded={panel==='custom'} onClick={()=>choosePanel('custom')}><span aria-hidden="true">↔</span>Individuell</button></div>
  </div>
  {panel&&<form className="affiliatePeriodEditor" onSubmit={submit}>
   <div className="affiliatePeriodEditorIntro"><strong>{panel==='calendar'?'Kalenderzeitraum':'Freier Zeitraum'}</strong><small>{panel==='calendar'?'Ganzes Jahr oder einzelnen Monat auswählen':'Start- und Enddatum frei festlegen'}</small></div>
   {panel==='calendar'?<><label>Jahr<select name="calendarYear" value={year} onChange={event=>chooseYear(event.target.value)}>{years.map(value=><option value={value} key={value}>{value}</option>)}</select></label><label>Monat<select name="calendarMonth" value={month} onChange={event=>setMonth(event.target.value)}><option value="all">Ganzes Jahr</option>{visibleMonths.map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label></>:<><label>Von<input type="date" name="from" required max={period.maxDate} defaultValue={period.from}/></label><label>Bis<input type="date" name="to" required max={period.maxDate} defaultValue={period.to}/></label></>}
   <button className="affiliatePeriodApply" disabled={pending}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 9.2 17 19 7"/></svg>Anwenden</button>
   {panel==='calendar'&&<small className="affiliatePeriodHint">Laufende Zeiträume enden automatisch heute.</small>}
  </form>}
  {pending&&<span className="affiliatePeriodPending" role="status"><i/>Zeitraum wird geladen …</span>}
 </div>
}
