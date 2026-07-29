import {describe,expect,it} from 'vitest';
import {moveSidebarItem,moveSidebarItemByVisibleOrder,parseSidebarOrder} from './sidebar-order';

const known=['/','/cohorts','/affiliates','/automation','/smartlinks'];

describe('custom sidebar order',()=>{
 it('accepts only known unique routes and appends newly available routes',()=>{
  expect(parseSidebarOrder('["/smartlinks","/","/smartlinks","/evil"]',known)).toEqual(['/smartlinks','/','/cohorts','/affiliates','/automation']);
  expect(parseSidebarOrder('broken',known)).toEqual(known);
 });
 it('moves a dragged route to the target position',()=>{
  expect(moveSidebarItem(known,'/smartlinks','/')).toEqual(['/smartlinks','/','/cohorts','/affiliates','/automation']);
  expect(moveSidebarItem(known,'/','/automation')).toEqual(['/cohorts','/affiliates','/automation','/','/smartlinks']);
 });
 it('moves by visible neighbors without losing hidden permission-gated routes',()=>{
  const visible=['/','/affiliates','/smartlinks'];
  expect(moveSidebarItemByVisibleOrder(known,visible,'/affiliates',-1)).toEqual(['/affiliates','/','/cohorts','/automation','/smartlinks']);
  expect(moveSidebarItemByVisibleOrder(known,visible,'/affiliates',1)).toEqual(['/','/cohorts','/automation','/smartlinks','/affiliates']);
  expect(moveSidebarItemByVisibleOrder(known,visible,'/',-1)).toEqual(known);
 });
});
