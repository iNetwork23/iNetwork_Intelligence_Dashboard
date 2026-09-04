'use client';
import{useCallback,useDeferredValue,useEffect,useMemo,useRef,useState}from'react';
import{NOT_BLOCKABLE_HINT,type SourceCandidateRange}from'@/lib/source-candidate-link';
import{sourceBlockIdentityKey,type SourceBlockRecord}from'@/lib/source-blocks';
import{berlinDay}from'@/lib/format-berlin';
import{withGlobalPeriod}from'@/lib/period-controls';
import{signTone}from'@/lib/verdict-vocabulary';
import{toneClass}from'@/lib/verdict-trust';
import{BULK_BLOCK_LIMIT,buildSourceCandidateQuery,firstSaleRate,maturityLabel,resolveCandidateBlock,selectSourceCandidates,SOURCE_CANDIDATE_PAGE_SIZE,toggleBulkSelection,trendLabel,verdictLabel,type SourceCandidateBlockState,type SourceCandidateFilters,type SourceCandidateRow,type SourceCandidateSort}from'@/lib/source-candidate-view';
import SourceBlockButton from'../affiliates/SourceBlockButton';
import InstantLink from'../affiliates/InstantLink';
import SourceBulkBlockDialog,{blockStateFromRecord}from'./SourceBulkBlockDialog';
type Props={rows:SourceCandidateRow[];range:SourceCandidateRange;openKey:string|null;initialFilters:SourceCandidateFilters;initialSort:SourceCandidateSort;mayBlock:boolean;finance:boolean;blockStatusUnknown?:boolean};
const euro=(value:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(value),integer=(value:number)=>new Intl.NumberFormat('de-DE').format(value);
const blockLabel=(block:SourceCandidateBlockState)=>block.status==='active'?`Gesperrt seit ${berlinDay(block.effectiveAt)}`:block.status==='pending'?'Verifizierung läuft':'Zustand unklar';
/** Tabelle der Quell-Kandidaten: Filter/Sortierung als URL-Zustand, Top-50 + „mehr anzeigen“ (D10), Deep-Link-Zeile hervorgehoben, Inline-Sperre und Mehrfachauswahl (max. 5). */
export default function SourceCandidateList({rows:initialRows,range,openKey,initialFilters,initialSort,mayBlock,finance,blockStatusUnknown=false}:Props){
 const[rows,setRows]=useState(initialRows),[filters,setFilters]=useState(initialFilters),[sort,setSort]=useState(initialSort),[limit,setLimit]=useState(SOURCE_CANDIDATE_PAGE_SIZE),[selected,setSelected]=useState<string[]>([]),[limitHint,setLimitHint]=useState(false),[bulkOpen,setBulkOpen]=useState(false),mounted=useRef(false);
 useEffect(()=>{setRows(initialRows);setSelected([])},[initialRows]);
 useEffect(()=>{if(!mounted.current){mounted.current=true;return}const query=buildSourceCandidateQuery(range,filters,sort,openKey);window.history.replaceState(window.history.state,'',withGlobalPeriod(`${window.location.pathname}?${query}`,window.location.search))},[range,filters,sort,openKey]);
 const deferredFilters=useDeferredValue(filters);
 const selection=useMemo(()=>selectSourceCandidates(rows,deferredFilters,sort,limit,openKey),[rows,deferredFilters,sort,limit,openKey]);
 const openRow=useMemo(()=>openKey?rows.find(row=>row.key===openKey)??null:null,[rows,openKey]);
 useEffect(()=>{if(!openRow)return;const frame=requestAnimationFrame(()=>document.getElementById(openRow.domId)?.scrollIntoView({block:'center'}));return()=>cancelAnimationFrame(frame)},[openRow]);
 const closeBulk=useCallback(()=>setBulkOpen(false),[]);
 const setBlock=useCallback((key:string,block:SourceCandidateBlockState|null)=>{setRows(current=>current.map(row=>row.key===key?{...row,block}:row));setSelected(current=>current.filter(item=>item!==key))},[]);
 /** Nach Aktionen den Sperrzustand aller Zeilen aus der Sperrliste nachziehen (auch fehlgeschlagene Aktivierungen erscheinen so als „Zustand unklar“). */
 const refreshBlocks=useCallback(async()=>{try{const response=await fetch('/api/source-blocks',{cache:'no-store'}),body=await response.json();if(!response.ok||!Array.isArray(body.blocks))return;const index=new Map<string,SourceBlockRecord>();for(const record of body.blocks as SourceBlockRecord[]){const key=sourceBlockIdentityKey(record);if(!index.has(key)||index.get(key)!.status==='inactive')index.set(key,record)}setRows(current=>current.map(row=>({...row,block:resolveCandidateBlock(row,index)})));setSelected([])}catch(error){console.error('Sperrstatus konnte nicht aktualisiert werden',error)}},[]);
 const onRecords=useCallback((key:string)=>(records:SourceBlockRecord[])=>{const record=records[0];if(!record)return;setBlock(key,record.status==='inactive'?null:blockStateFromRecord(record))},[setBlock]);
 const toggle=(key:string)=>{const next=toggleBulkSelection(selected,key,BULK_BLOCK_LIMIT);setSelected(next.selected);setLimitHint(next.rejected)};
 const selectedRows=rows.filter(row=>selected.includes(row.key)&&!row.block&&row.blockable);
 const update=(patch:Partial<SourceCandidateFilters>)=>{setFilters(current=>({...current,...patch}));setLimit(SOURCE_CANDIDATE_PAGE_SIZE)};
 const colSpan=finance?14:11;
 return <section className="sourcesPanel">
  <div className="sourcesToolbar">
   <form className="sourcesFilters" onSubmit={event=>event.preventDefault()} aria-label="Filter der Quellenliste">
    <label>Aktion<select value={filters.action} onChange={event=>update({action:event.target.value as SourceCandidateFilters['action']})}><option value="all">Alle</option><option value="AUSSCHALTEN">{verdictLabel('AUSSCHALTEN')}</option><option value="SKALIEREN">SKALIEREN</option><option value="BEOBACHTEN">BEOBACHTEN</option></select></label>
    <label>Modus<select value={filters.mode} onChange={event=>update({mode:event.target.value as SourceCandidateFilters['mode']})}><option value="all">Alle</option><option value="tracked">Tracked</option><option value="api">API</option></select></label>
    <label>Sperrstatus<select value={filters.blocked} onChange={event=>update({blocked:event.target.value as SourceCandidateFilters['blocked']})}><option value="all">Alle</option><option value="open">Ungesperrt</option><option value="blocked">Gesperrt</option></select></label>
    <label>Sortierung<select value={sort} onChange={event=>setSort(event.target.value as SourceCandidateSort)}>{finance&&<option value="profit">Profit aufsteigend</option>}{finance&&<option value="payout">Payout absteigend</option>}{!finance&&<option value="profit">Standard</option>}<option value="sois">SOIs absteigend</option><option value="clicks">Klicks absteigend</option></select></label>
    <label>Suche<input value={filters.q} onChange={event=>update({q:event.target.value})} placeholder="Partner, Offer, Quelle …" maxLength={100}/></label>
   </form>
   <p className="sourcesCount" role="status">{selection.matched===rows.length?`${rows.length} Kandidaten`:`${selection.matched} von ${rows.length} Kandidaten`}{selection.hidden>0?` · ${selection.rows.length} sichtbar`:''}</p>
  </div>
  {mayBlock&&<div className="sourcesBulkBar" aria-live="polite"><span>{selectedRows.length} von {BULK_BLOCK_LIMIT} ausgewählt</span>{limitHint&&<small role="alert">Maximal {BULK_BLOCK_LIMIT} Quellen gleichzeitig – bitte zuerst eine Auswahl aufheben.</small>}<button type="button" className="sourcesBulkButton" disabled={!selectedRows.length} onClick={()=>setBulkOpen(true)}>Ausgewählte sperren</button></div>}
  <div className="tableWrap sourcesTableWrap"><table className="performanceTable sourcesTable"><caption className="srOnly">Partnerübergreifende Quellen mit Handlungsbedarf</caption>
   <thead><tr><th scope="col">{mayBlock?'Auswahl':'#'}</th><th scope="col">Partner</th><th scope="col">Offer</th><th scope="col">Quelle</th><th scope="col">Klicks</th><th scope="col">SOIs</th><th scope="col">First-Sales</th><th scope="col">Rebills</th>{finance&&<><th scope="col">Payout</th><th scope="col">Umsatz</th><th scope="col">Profit</th></>}<th scope="col">Verdikt</th><th scope="col">Lead-Status</th><th scope="col">Sperrstatus</th></tr></thead>
   <tbody>{selection.rows.map((row,index)=>{const isOpen=row.key===openKey,checked=selected.includes(row.key);return <tr key={row.key} id={row.domId} className={isOpen?'sourcesOpenRow':undefined} aria-current={isOpen?'true':undefined}>
    <td data-label={mayBlock?'Auswahl':'#'}>{mayBlock&&!row.block&&row.blockable?<label className="sourcesSelect"><input type="checkbox" checked={checked} onChange={()=>toggle(row.key)} aria-label={`${row.affiliate} · ${row.offer} · ${row.mainValue||'nicht übermittelt'} auswählen`}/></label>:integer(index+1)}</td>
    <td data-label="Partner"><b>{row.affiliate}</b><small>#{row.affiliateId}</small></td>
    <td data-label="Offer"><b>{row.offer} · #{row.offerId}</b><small>{row.offerUrl}{row.offerUrlId!=='0'?` · URL #${row.offerUrlId}`:''}</small></td>
    <td data-label="Quelle"><b>{row.level==='sub_source'?`${row.mainValue||'nicht übermittelt'} → ${row.subValue||'nicht übermittelt'}`:(row.mainValue||'nicht übermittelt')}</b><small>{row.trafficMode==='api'?'API · aus Offer-Name erkannt':'Tracked'} · {row.level==='sub_source'?'Unterquelle':'Hauptquelle'}</small></td>
    <td data-label="Klicks">{row.trafficMode==='api'?'n/a':integer(row.clicks)}</td>
    <td data-label="SOIs">{integer(row.sois)}</td>
    <td data-label="First-Sales">{integer(row.firstSales)}<small>{firstSaleRate(row)}</small></td>
    <td data-label="Rebills">{integer(row.rebills)}</td>
    {finance&&<><td data-label="Payout">{row.payout===null?'–':euro(row.payout)}</td><td data-label="Umsatz">{row.revenue===null?'–':euro(row.revenue)}</td><td data-label="Profit" className={toneClass(signTone(row.profit??0,row))}><b>{row.profit===null?'–':euro(row.profit)}</b></td></>}
    <td data-label="Verdikt"><span className={`sourcesVerdict ${row.severity}`}>{verdictLabel(row.action)}</span><small>{row.reason}</small></td>
    <td data-label="Lead-Status">{row.leadStatus??'–'}<small>{maturityLabel(row)}</small></td>
    <td data-label="Sperrstatus">{blockStatusUnknown?'–':row.block?<><b className={`sourcesBlocked ${row.block.status}`}>{blockLabel(row.block)}</b>{mayBlock&&<InstantLink href="/source-blocks" className="sourcesBlockLink">Sperre ansehen</InstantLink>}{row.block.status==='error'&&mayBlock&&row.blockable&&<div className="sourcesRowAction"><SourceBlockButton affiliateId={row.affiliateId} affiliateName={row.affiliate} offerId={row.offerId} offerName={row.offer} trafficMode={row.trafficMode} level={row.level} mainValue={row.mainValue} subValue={row.subValue} showMoney={finance} onBlocked={onRecords(row.key)}/></div>}</>:!row.blockable?<span className="sourcesNotBlockable">{NOT_BLOCKABLE_HINT}</span>:mayBlock?<div className="sourcesRowAction"><SourceBlockButton autoOpen={isOpen} affiliateId={row.affiliateId} affiliateName={row.affiliate} offerId={row.offerId} offerName={row.offer} trafficMode={row.trafficMode} level={row.level} mainValue={row.mainValue} subValue={row.subValue} showMoney={finance} metrics={{payout:row.payout,sois:row.sois,profit:row.profit,clicks:row.clicks,firstSales:row.firstSales,maturity:maturityLabel(row),leadStatus:row.leadStatus,trend:trendLabel(row,finance)}} onBlocked={records=>{const record=records.find(item=>item.offerId===Number(row.offerId))??records[0];if(record)setBlock(row.key,record.status==='inactive'?null:blockStateFromRecord(record))}}/></div>:'Nicht gesperrt'}</td>
   </tr>})}
   {!selection.rows.length&&<tr><td colSpan={colSpan} className="sourcesEmptyRow">{rows.length?'Keine Quelle passt zu diesem Filter.':'Keine Quelle mit Handlungsbedarf im Rollup.'}</td></tr>}
   </tbody></table></div>
  {openKey&&!openRow&&<p className="sourcesNotice" role="status">Die verlinkte Quelle ist in diesem Rollup nicht mehr enthalten – der Handlungsbedarf kann sich seit dem Link geändert haben.</p>}
  {selection.hidden>0&&<button type="button" className="showMoreSources" onClick={()=>setLimit(current=>current+SOURCE_CANDIDATE_PAGE_SIZE)}>Weitere {integer(Math.min(SOURCE_CANDIDATE_PAGE_SIZE,selection.hidden))} von {integer(selection.hidden)} Quellen anzeigen</button>}
  {bulkOpen&&selectedRows.length>0&&<SourceBulkBlockDialog rows={selectedRows.slice(0,BULK_BLOCK_LIMIT)} finance={finance} onClose={closeBulk} onBlocked={setBlock} onFinished={refreshBlocks}/>}
 </section>;
}
