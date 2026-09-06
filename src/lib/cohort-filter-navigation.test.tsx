// @vitest-environment jsdom
import React,{act,type ReactElement}from'react';
import{createRoot,type Root}from'react-dom/client';
import{afterEach,beforeEach,describe,expect,it,vi}from'vitest';
import{parseAccessMetadata}from'./rbac';
vi.mock('./session',()=>({currentUser:async()=>({access:parseAccessMetadata({role:'super_admin'})})}));
vi.mock('./cohorts',()=>({getLtvCohorts:async()=>['7','8'].map(affiliate_id=>({registration_month:'2026-07-01',affiliate_id,offer_id:'1',campaign_id:'0',source_id:'saved',sub_source:'sub',registrations:1,revenue_30d:0,revenue_60d:0,revenue_90d:0,revenue_180d:0,revenue_365d:0}))}));
vi.mock('./dashboard-service',()=>({getDashboard:async()=>({affiliates:[]})}));
vi.mock('./data-status',()=>({getDataStatus:async()=>({}),ltvHeaderStatus:()=>({label:'Test',tone:'neutral'})}));
vi.mock('../app/affiliates/InstantLink',()=>({default:({href,children}:{href:string;children:React.ReactNode})=><a href={href}>{children}</a>}));
import CohortsPage from'../app/cohorts/page';
let root:Root;
const field=(name:string)=>document.querySelector(`[name="${name}"]`)as HTMLInputElement|HTMLSelectElement;
async function renderFilters(filters:{source?:string;sub_source?:string;affiliate?:string;page?:string}){
 const page=await CohortsPage({searchParams:Promise.resolve(filters)});
 const form=React.Children.toArray(page.props.children).find(child=>React.isValidElement(child)&&child.type==='form')as ReactElement;
 expect(form).toBeDefined();
 await act(async()=>root.render(form));
}
beforeEach(()=>{vi.stubGlobal('React',React);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);document.body.replaceChildren();const host=document.createElement('div');document.body.append(host);root=createRoot(host)});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals()});
describe('cohort filters follow server navigation',()=>{
 it('clears dirty source, subsource and partner controls after resetting the URL',async()=>{
  await renderFilters({source:'saved',sub_source:'sub',affiliate:'7'});
  field('source').value='draft-source';field('sub_source').value='draft-sub';field('affiliate').value='8';
  await renderFilters({});
  expect(field('source').value).toBe('');expect(field('sub_source').value).toBe('');expect(field('affiliate').value).toBe('');
 });
 it('shows the restored query values after navigating to a different filter selection',async()=>{
  await renderFilters({source:'first',sub_source:'one',affiliate:'7'});field('source').value='unsaved';
  await renderFilters({source:'second',sub_source:'two',affiliate:'8'});
  expect(field('source').value).toBe('second');expect(field('sub_source').value).toBe('two');expect(field('affiliate').value).toBe('8');
 });
 it('preserves an unfinished edit when only the page changes with identical filters',async()=>{
  await renderFilters({source:'saved',page:'1'});field('source').value='unfinished';
  await renderFilters({source:'saved',page:'2'});
  expect(field('source').value).toBe('unfinished');
 });
});
