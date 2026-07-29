'use client';
import{useState}from'react';
export default function DataReloadButton(){
 const[loading,setLoading]=useState(false);
 const reload=()=>{setLoading(true);globalThis.location.reload()};
 return <button type="button" className="dataReloadButton" aria-label="Affiliate-Daten neu laden" aria-busy={loading} onClick={reload} disabled={loading}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.34 5.66"/><path d="M20 4v7h-7"/></svg><span>{loading?'Daten werden neu geladen …':'Daten neu laden'}</span></button>;
}
