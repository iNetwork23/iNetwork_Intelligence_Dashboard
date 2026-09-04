import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';
import {companyResultState,filterCompanies} from './portfolio-company-search';

type Company={id:string;name:string};
const companies:Company[]=[
 {id:'32',name:'LosPollos'},
 {id:'6',name:'TrafficPartner'},
 {id:'436',name:'Traffic Company'},
];

describe('portfolio company search',()=>{
 it('filters companies case-insensitively by name or exact-visible affiliate ID',()=>{
  expect(filterCompanies(companies,'pollos').map(row=>row.id)).toEqual(['32']);
  expect(filterCompanies(companies,'TRAFFIC').map(row=>row.id)).toEqual(['6','436']);
  expect(filterCompanies(companies,'#436').map(row=>row.id)).toEqual(['436']);
  expect(filterCompanies(companies,'  ').map(row=>row.id)).toEqual(['32','6','436']);
 });

 it('distinguishes an empty portfolio from an empty search result',()=>{
  expect(companyResultState(0,'')).toBe('portfolio-empty');
  expect(companyResultState(0,'pollos')).toBe('search-empty');
  expect(companyResultState(1,'pollos')).toBeNull();
 });

 it('wires a company-only search form into the affiliate portfolio view',()=>{
  const page=readFileSync(join(process.cwd(),'src/app/page.tsx'),'utf8');
  for(const marker of ['Firmen suchen','name="company"','Firma oder Affiliate-ID','Keine Firma gefunden','filterCompanies'])expect(page).toContain(marker);
  expect(page).toContain("view==='affiliates'");
 });
});
