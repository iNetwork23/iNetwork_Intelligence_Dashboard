import{describe,expect,it}from'vitest';
import{paginateLtvCohorts}from'./cohort-pagination';
import type{LtvCohort}from'./cohorts';
const row=(month:string,source:string,sub:string,registrations:number,revenue:number):LtvCohort=>({registration_month:month,affiliate_id:'a',offer_id:'o',campaign_id:'c',source_id:source,sub_source:sub,registrations,revenue_30d:revenue,revenue_60d:revenue,revenue_90d:revenue,revenue_180d:revenue,revenue_365d:revenue});
describe('cohort result pagination',()=>{
 it('aggregates hidden affiliate, offer, and campaign dimensions before rendering',()=>{const result=paginateLtvCohorts([row('2026-07-01','s','sub',2,3),{...row('2026-07-01','s','sub',4,5),affiliate_id:'b',offer_id:'x'}],1,100);expect(result.total).toBe(1);expect(result.rows[0]).toMatchObject({registrations:6,revenue_30d:8,revenue_365d:8})});
 it('returns only one bounded page and clamps invalid page numbers',()=>{const rows=Array.from({length:235},(_,i)=>row(`2026-${String(12-Math.floor(i/20)).padStart(2,'0')}-01`,`s${i}`,'',i+1,i));const result=paginateLtvCohorts(rows,99,100);expect(result.pages).toBe(3);expect(result.page).toBe(3);expect(result.rows).toHaveLength(35);expect(result.rows[0].registration_month>=result.rows.at(-1)!.registration_month).toBe(true)});
});
