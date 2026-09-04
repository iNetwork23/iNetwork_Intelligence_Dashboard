'use client';
import{useEffect,useMemo,useRef,useState,useTransition,type FormEvent}from'react';
import{usePathname,useRouter,useSearchParams}from'next/navigation';
import{dashboardMonthOptions}from'@/lib/dashboard-months';
import{buildPeriodQuery,detectPeriodEditor,GLOBAL_PERIOD_PRESETS,periodCalendarRange,SOURCE_PERIOD_PRESETS,type PeriodDimension,type PeriodEditor}from'@/lib/period-controls';
/**
 * Die eine Zeitraum-Komponente (D5). dimension 'global' = period/from/to, 'source' = sourcePeriod/sourceFrom/sourceTo.
 * Presets, Monat/Jahr-Raster und freier Bereich in einer Form; fremde URL-Parameter bleiben erhalten (period-controls.ts).
 */
export type PeriodControlsProps={dimension:PeriodDimension;period:string;from?:string;to?:string;rangeLabel:string;maxDate:string;compact?:boolean;error?:string|null;todayNote?:string|null;presets?:readonly string[]};
/** Quellen-Dimension: offene Offer-/Quellen-Disclosures überleben die Navigation (sourceOpen + Anker). */
export const collectOpenSourceDetails=(node:HTMLElement|null)=>{const outer=node?.closest<HTMLDetailsElement>('details[id]');if(!outer)return{ids:[] as string[],anchorId:''};const details=[outer,...outer.querySelectorAll<HTMLDetailsElement>('details[open][id]')],ids=[...new Set(details.filter(item=>item.open).map(item=>item.id))];return{ids,anchorId:outer.id}};
const monthEnd=(range:{from:string;to:string})=>`${range.from.slice(8,10)}.${range.from.slice(5,7)}.–${range.to.slice(8,10)}.${range.to.slice(5,7)}.`;
export default function PeriodControls({dimension,period,from,to,rangeLabel,maxDate,compact=false,error=null,todayNote=null,presets}:PeriodControlsProps){
 const router=useRouter(),pathname=usePathname(),searchParams=useSearchParams(),root=useRef<HTMLDivElement>(null),[pending,startTransition]=useTransition(),maxYear=Number(maxDate.slice(0,4));
 const allPresets=dimension==='global'?GLOBAL_PERIOD_PRESETS:SOURCE_PERIOD_PRESETS,visiblePresets=presets?allPresets.filter(([id])=>presets.includes(id)):allPresets,calendarPeriod=dimension==='source'?'calendar':'custom';
 const detected=useMemo(()=>detectPeriodEditor(period,from,to,maxDate),[period,from,to,maxDate]),selectedYear=detected.year,selectedMonth=detected.month;
 const[year,setYear]=useState(selectedYear??String(maxYear)),[panel,setPanel]=useState<PeriodEditor>(detected.editor),[customFrom,setCustomFrom]=useState(from??''),[customTo,setCustomTo]=useState(to??'');
 const options=useMemo(()=>dashboardMonthOptions(year,maxDate),[year,maxDate]),yearRange=periodCalendarRange(year,'all',maxDate),years=Array.from({length:11},(_,index)=>String(maxYear-index));
 useEffect(()=>{setCustomFrom(from??'');setCustomTo(to??'');if(detected.editor===null){setPanel(error?'custom':null);return}if(detected.editor==='months'&&detected.year)setYear(detected.year);setPanel(detected.editor)},[period,from,to,error,detected.editor,detected.year]);
 const navigate=(selection:{period:string;from?:string;to?:string})=>{const query=new URLSearchParams(buildPeriodQuery(searchParams,dimension,selection));let anchor='';if(dimension==='source'){const{ids,anchorId}=collectOpenSourceDetails(root.current);if(ids.length)query.set('sourceOpen',ids.join(','));else query.delete('sourceOpen');anchor=anchorId}startTransition(()=>router.push(`${pathname}?${query}${anchor?`#${encodeURIComponent(anchor)}`:''}`,{scroll:false}))};
 const choosePreset=(next:string)=>{setPanel(null);navigate({period:next})};
 const chooseMonth=(month:string)=>{const range=month==='all'?yearRange:options.find(item=>item.id===month)?.range;if(!range)return;setPanel('months');navigate({period:calendarPeriod,...range})};
 const submitCustom=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();navigate({period:'custom',from:customFrom,to:customTo})};
 const togglePanel=(next:Exclude<PeriodEditor,null>)=>setPanel(value=>value===next?null:next);
 const isActive=(id:string)=>period===id,monthActive=(month:string)=>selectedYear===year&&selectedMonth===month,yearActive=selectedYear===year&&selectedMonth==='all';
 const todayMarker=isActive('today')&&todayNote?<small className="periodPartialDay" role="note">{todayNote}</small>:null;
 const presetButtons=<div className={dimension==='source'?'sourcePeriodPresets':compact?'affiliatePresetButtons':'dashboardPresetButtons'} role="group" aria-label={dimension==='source'?'Zeitraum der Quellenauswertung':'Schnelle Zeiträume'}>{dimension==='source'&&<small>Zeitraum</small>}{visiblePresets.map(([id,label])=><button type="button" key={id} className={isActive(id)?'active':''} aria-pressed={isActive(id)} disabled={pending} title={id==='today'&&todayNote?todayNote:undefined} onClick={()=>choosePreset(id)}>{label}</button>)}{dimension==='source'&&<><button type="button" className={panel==='months'?'active':''} aria-expanded={panel==='months'} onClick={()=>togglePanel('months')}>Jahr / Monat</button><button type="button" className={panel==='custom'?'active':''} aria-expanded={panel==='custom'} onClick={()=>togglePanel('custom')}>Individuell</button></>}</div>;
 if(compact)return <div className="periodControls compactPeriodControls" aria-busy={pending}><small>ZEITRAUM</small>{presetButtons}{todayMarker}<b>{rangeLabel}</b></div>;
 const monthPicker=panel==='months'&&<div className="dashboardMonthPicker">
  <div className="dashboardMonthYear"><button type="button" aria-label="Vorheriges Jahr" disabled={Number(year)<=maxYear-10||pending} onClick={()=>setYear(String(Number(year)-1))}>‹</button><label>Jahr<select value={year} onChange={event=>setYear(event.target.value)}>{years.map(value=><option key={value}>{value}</option>)}</select></label><button type="button" aria-label="Nächstes Jahr" disabled={Number(year)>=maxYear||pending} onClick={()=>setYear(String(Number(year)+1))}>›</button></div>
  <div className="dashboardMonthGrid" role="group" aria-label="Monate"><button type="button" disabled={!yearRange||pending} className={yearActive?'active':''} aria-pressed={yearActive} onClick={()=>chooseMonth('all')}><b>Ganzes Jahr</b><small>{yearRange?monthEnd(yearRange):'Noch nicht verfügbar'}</small></button>{options.map(month=><button type="button" key={month.id} disabled={month.disabled||pending} className={monthActive(month.id)?'active':''} aria-pressed={monthActive(month.id)} onClick={()=>chooseMonth(month.id)}><b>{month.label}</b><small>{month.range?monthEnd(month.range):'Noch nicht verfügbar'}</small></button>)}</div>
 </div>;
 const customForm=panel==='custom'&&<form className="dashboardCustomPeriod" onSubmit={submitCustom}><div><strong>Freier Zeitraum</strong><small>Start- und Enddatum festlegen</small></div><label>Von<input required type="date" name="from" max={maxDate} value={customFrom} onChange={event=>setCustomFrom(event.target.value)}/></label><label>Bis<input required type="date" name="to" max={maxDate} value={customTo} onChange={event=>setCustomTo(event.target.value)}/></label><button type="submit" disabled={pending}>Anwenden</button></form>;
 const feedback=<>{error&&<p className="periodError" role="alert">{error}</p>}{pending&&<span className="dashboardPeriodPending" role="status"><i/>Zeitraum wird geladen …</span>}</>;
 if(dimension==='source')return <div ref={root} className="periodControls sourcePeriodControls" aria-busy={pending}>{presetButtons}{todayMarker}{monthPicker}{customForm}{feedback}</div>;
 return <section className="periodControls dashboardPeriod" aria-busy={pending}>
  <header><div><span>BERICHTSZEITRAUM</span><b>{rangeLabel}</b>{todayMarker}</div><small>Berlin</small></header>
  <div className="dashboardPeriodToolbar">
   {presetButtons}
   <div className="dashboardPeriodModes" role="group" aria-label="Zeitraum genauer auswählen"><button type="button" className={panel==='months'?'active':''} aria-expanded={panel==='months'} onClick={()=>togglePanel('months')}><span aria-hidden="true">▦</span>Jahr / Monat</button><button type="button" className={panel==='custom'?'active':''} aria-expanded={panel==='custom'} onClick={()=>togglePanel('custom')}><span aria-hidden="true">↔</span>Individuell</button></div>
  </div>
  {monthPicker}{customForm}{feedback}
 </section>;
}
