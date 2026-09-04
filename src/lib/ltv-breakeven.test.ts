import{describe,expect,it}from'vitest';
import{breakEvenSummary,buildLtvCurve,cohortMature,entityRates,findBreakEven,LTV_WINDOWS,ltvBreakevenHref,ltvSparklinePoints,type LtvCurve}from'./ltv-breakeven';
import type{LtvCohort}from'./cohorts';

const NOW=new Date('2026-09-04T10:00:00Z');
const cohort=(month:string,affiliate:string,registrations:number,revenue:[number,number,number,number,number],extra:Partial<LtvCohort>={}):LtvCohort=>({registration_month:month,affiliate_id:affiliate,offer_id:'o1',campaign_id:'0',source_id:'s',sub_source:'',registrations,revenue_30d:revenue[0],revenue_60d:revenue[1],revenue_90d:revenue[2],revenue_180d:revenue[3],revenue_365d:revenue[4],...extra});
const euro=(value:number)=>`${value.toFixed(2).replace('.',',')} €`;

describe('Kohorten-Reife',()=>{
 it('ist reif, wenn der letzte Tag des Monats plus Fenster vor dem Stichtag liegt',()=>{
  expect(cohortMature('2025-08-01',365,NOW)).toBe(true); // 31.08.2025 + 365 = 31.08.2026
  expect(cohortMature('2025-09-01',365,NOW)).toBe(false); // 30.09.2025 + 365 = 30.09.2026
  expect(cohortMature('2026-07-01',30,NOW)).toBe(true); // 31.07. + 30 = 30.08.
  expect(cohortMature('2026-08-01',30,NOW)).toBe(false); // 31.08. + 30 = 30.09.
  expect(cohortMature('2026-08-01',60,NOW)).toBe(false);
 });
 it('behandelt ungültige Monate als unreif',()=>{expect(cohortMature('garbage',30,NOW)).toBe(false);expect(cohortMature('',30,NOW)).toBe(false)});
});

describe('LTV-Kurve je Partner',()=>{
 it('gewichtet die Kurve über Kohorten-Monate (Summe Umsatz ÷ Summe Registrierungen je Fenster) und filtert nach Partner',()=>{
  const rows=[cohort('2025-06-01','7',100,[50,80,100,150,200]),cohort('2025-07-01','7',300,[90,120,150,240,330]),cohort('2025-07-01','8',1000,[9000,9000,9000,9000,9000]),cohort('2025-07-01','7',0,[0,0,0,0,0],{offer_id:'o2'})];
  const curve=buildLtvCurve(rows,'7',NOW);
  expect(curve.affiliateId).toBe('7');
  expect(curve.registrations).toBe(400);
  expect(curve.months).toEqual(['2025-06-01','2025-07-01']);
  expect(curve.points.map(p=>p.window)).toEqual([...LTV_WINDOWS]);
  expect(curve.points.map(p=>p.perRegistration)).toEqual([140/400,200/400,250/400,390/400,530/400]);
  expect(curve.points.every(p=>p.mature&&p.matureMonths===2&&p.totalMonths===2)).toBe(true);
  expect(curve.immatureMonths365).toEqual([]);
 });
 it('schließt unreife Monate je Fenster aus und meldet Fenster ohne reife Kohorte als unreif',()=>{
  const rows=[cohort('2025-10-01','7',100,[100,100,100,100,999]),cohort('2026-08-01','7',100,[5,5,5,5,5])];
  const curve=buildLtvCurve(rows,'7',NOW);
  const by=Object.fromEntries(curve.points.map(p=>[p.window,p]));
  expect(by[30]).toMatchObject({perRegistration:1,matureMonths:1,totalMonths:2,mature:true}); // August 2026 noch keine 30 Tage alt → nur Oktober zählt
  expect(by[180]).toMatchObject({perRegistration:1,matureMonths:1,mature:true});
  expect(by[365]).toMatchObject({perRegistration:null,matureMonths:0,totalMonths:2,mature:false});
  expect(curve.immatureMonths365).toEqual(['2025-10-01','2026-08-01']);
 });
 it('liefert eine leere Kurve ohne Zeilen des Partners',()=>{
  const curve=buildLtvCurve([cohort('2025-06-01','9',10,[1,1,1,1,1])],'7',NOW);
  expect(curve.registrations).toBe(0);expect(curve.months).toEqual([]);expect(curve.points.every(p=>p.perRegistration===null&&!p.mature)).toBe(true);
 });
 it('Sparkline-Punkte enthalten nur reife Fenster in Fensterreihenfolge',()=>{
  const rows=[cohort('2025-10-01','7',100,[100,120,130,140,150])];
  expect(ltvSparklinePoints(buildLtvCurve(rows,'7',NOW))).toEqual([1,1.2,1.3,1.4]);
 });
});

describe('CPL und Umsatz je SOI aus der Portfolio-Zeile',()=>{
 it('rechnet Payout je SOI (D17) und Umsatz je SOI, null ohne SOIs oder ohne Zeile',()=>{
  expect(entityRates({payout:120,sois:100,revenue:105})).toEqual({cpl:1.2,revenuePerSoi:1.05});
  expect(entityRates({payout:120,sois:0,revenue:5})).toEqual({cpl:null,revenuePerSoi:null});
  expect(entityRates(null)).toEqual({cpl:null,revenuePerSoi:null});
  expect(entityRates(undefined)).toEqual({cpl:null,revenuePerSoi:null});
 });
});

describe('Break-even',()=>{
 const curve=(values:(number|null)[],registrations=400):LtvCurve=>({affiliateId:'7',registrations,months:['2025-06-01'],immatureMonths365:values[4]===null?['2025-06-01']:[],points:LTV_WINDOWS.map((window,i)=>({window,registrations:values[i]===null?0:registrations,revenue:(values[i]??0)*registrations,perRegistration:values[i],matureMonths:values[i]===null?0:1,totalMonths:1,mature:values[i]!==null}))});
 it('findet das erste reife Fenster mit LTV je Registrierung ≥ CPL',()=>{
  const result=findBreakEven(curve([0.8,1.1,1.35,1.6,1.9]),1.2);
  expect(result).toMatchObject({status:'reached',window:90,cpl:1.2,ltv:1.35});
  expect(breakEvenSummary(result,euro)).toBe('Break-even nach 90 Tagen · CPL 1,20 € · LTV 90 Tage 1,35 €');
 });
 it('gilt bereits im ersten Fenster bei CPL 0 und meldet nicht erreicht, wenn alle Fenster reif sind',()=>{
  expect(findBreakEven(curve([0,0,0,0,0]),0)).toMatchObject({status:'reached',window:30});
  const result=findBreakEven(curve([0.8,0.9,1,1.1,1.15]),1.2);
  expect(result).toMatchObject({status:'not_reached',window:null,ltv:1.15});
  expect(breakEvenSummary(result,euro)).toBe('Break-even nicht erreicht · CPL 1,20 € · LTV 365 Tage 1,15 €');
 });
 it('bleibt offen, wenn kein reifes Fenster die CPL erreicht, aber Fenster noch unreif sind',()=>{
  const result=findBreakEven(curve([0.8,0.9,1,null,null]),1.2);
  expect(result).toMatchObject({status:'open',window:null,ltv:1});
  expect(breakEvenSummary(result,euro)).toBe('Break-even noch offen · CPL 1,20 € · LTV 90 Tage 1,00 € · Fenster ab 180 Tagen noch nicht reif');
 });
 it('meldet fehlende CPL und fehlende Kohorten getrennt',()=>{
  expect(findBreakEven(curve([0.8,0.9,1,1.1,1.15]),null)).toMatchObject({status:'no_cpl',window:null,cpl:null});
  expect(breakEvenSummary(findBreakEven(curve([0.8,0.9,1,1.1,1.15]),null),euro)).toBe('Break-even nicht berechenbar · CPL ohne SOIs im Zeitraum');
  expect(findBreakEven(curve([null,null,null,null,null],0),1.2)).toMatchObject({status:'no_data'});
  expect(breakEvenSummary(findBreakEven(curve([null,null,null,null,null],0),1.2),euro)).toBe('Break-even nicht berechenbar · keine reifen Kohorten');
 });
});

describe('Link-Ziel LTV je Partner',()=>{
 it('baut /cohorts?affiliate=<id> und nimmt nur den globalen Zeitraum mit',()=>{
  expect(ltvBreakevenHref('154')).toBe('/cohorts?affiliate=154');
  expect(ltvBreakevenHref('154',{period:'7d'})).toBe('/cohorts?affiliate=154&period=7d');
  expect(ltvBreakevenHref('154',{period:'custom',from:'2026-08-01',to:'2026-08-31'})).toBe('/cohorts?affiliate=154&period=custom&from=2026-08-01&to=2026-08-31');
  expect(ltvBreakevenHref('a b',{})).toBe('/cohorts?affiliate=a+b');
 });
});
