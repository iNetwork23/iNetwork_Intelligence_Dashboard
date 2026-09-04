import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';

/** D14 (Etappe 4): interne Rollen ohne finance.view sehen Cockpit und Quellen-Listen mit Verdikt und Volumen; Geldwerte weder im Markup noch im RSC-Payload. Partner unverändert (D7). */
const page=readFileSync(join(process.cwd(),'src/app/affiliates/page.tsx'),'utf8');
const between=(from:string,to:string)=>{const start=page.indexOf(from),end=page.indexOf(to,start);expect(start,from).toBeGreaterThan(-1);expect(end,to).toBeGreaterThan(start);return page.slice(start,end)};

describe('Partnerseite ohne finance.view (D14)',()=>{
 it('has no finance early return anymore – the finance flag is decided once, before the data is loaded',()=>{
  expect(page).not.toContain('title="Freigegebene Partner"\n          status="Nur Lesen"');
  expect(page).not.toMatch(/if \(!finance\)\s*return \(/);
  expect(page.indexOf('const finance = can(user.access, "finance.view")')).toBeLessThan(page.indexOf('getAffiliateOptimizationsWithTrend('));
  // Bestehende Verträge bleiben (unification/access-boundaries).
  expect(page).toContain('const maySmartlinks = can(user.access, "smartlinks.view") && can(user.access, "finance.view")');
 });
 it('strips money from every prop that reaches a client component before rendering it',()=>{
  expect(page).toContain('import { projectWithoutFinance } from "@/lib/finance-projection"');
  expect(page).toContain('projectWithoutFinance(analyses, finance)');
  expect(page).toContain('projectWithoutFinance(sourceRows, finance)');
  expect(page).toContain('analyses={clientAnalyses}');
  expect(page).toMatch(/rows=\{clientSourceRows\.filter\(/);
  expect(page).toContain('finance={finance}');
  expect(page.match(/finance=\{finance\}/g)?.length).toBeGreaterThanOrEqual(2);
 });
 it('loads and passes daily profit series and the money partner picker only with finance.view',()=>{
  expect(between('eagerSourceDaily =','eagerDirectSourceData =')).toContain('finance &&');
  expect(between('getPortfolioDailyByVariant(',']);')).toBeTruthy();
  expect(page).toContain('mayPartners && finance && !query.affiliate');
  expect(page).toContain('dailyByKey={finance ? cockpitDaily : undefined}');
  expect(page).toContain('{finance && (\n          <AffiliatePartnerPicker');
 });
 it('never resolves a campaign-only partner into the smartlink mode without smartlinks.view and finance.view',()=>{
  expect(page).toContain('workspaces.find((x) => x.affiliateId === query.affiliate && (maySmartlinks || x.direct))');
  expect(page).toContain('{selectedWorkspace?.campaigns.length && maySmartlinks ? (');
  expect(page).toContain('className="financeHiddenNote"');
  expect(readFileSync(join(process.cwd(),'src/app/globals.css'),'utf8')).toContain('.affiliateOptimizer .financeHiddenNote{');
 });
 it('renders money in the server markup only through the finance-gated helpers',()=>{
  const helpers=between('const moneyText =','export default async function');
  expect(helpers).toContain('finance ? eur(n) : "–"');
  expect(helpers).toContain('finance ? n : Number.NaN');
  const body=page.slice(page.indexOf('<main className="dashboard affiliateOptimizer affiliateDecisionDesk">'));
  // Ausserhalb des Smartlink-Modus (nur mit finance.view erreichbar) kein ungeschütztes eur().
  const direct=body.slice(body.indexOf(') : selected && activeOffer ? ('));
  for(const match of direct.matchAll(/eur\(/g))expect(direct.slice(Math.max(0,(match.index??0)-10),match.index),`ungeschütztes eur() bei ${direct.slice(match.index,(match.index??0)+40)}`).toMatch(/finance \? $|finance && $/);
  expect(direct).toContain('{finance && (\n                        <ProfitPeriod');
  expect(direct).toContain('finance && !sourceError');
  expect(direct).toContain('Quellen je Landingpage mit Umsatz und Profit sind nur mit Finanzrecht sichtbar');
  expect(direct).toContain('evidence.filter((line) => finance || !line.includes("€"))');
 });
 it('keeps the read-only header for roles without finance.view and without block rights, otherwise the sync-state header',()=>{
  expect(page).toContain('{finance || canManageSources ? (');
  expect(page).toContain('status="Nur Lesen"');
  expect(page).toContain('status={header.label}');
 });
 it('keeps the sign colour on signTone/toneClass and shows volume instead of money in the partner list',()=>{
  expect(page.match(/toneClass\(signTone\(/g)?.length).toBeGreaterThanOrEqual(11);
  expect(page).toContain('finance ? eur(a.direct.totals30.profit) : `${num(a.direct.totals30.sois)} SOIs`');
 });
});
