import {describe,expect,it} from 'vitest';
import {filterAffiliateChoices,parseAffiliatePins,sortAffiliateChoices,toggleAffiliatePin} from './affiliate-pins';

const partners=[
 {id:'190',name:'7 Click – Orioncrest',directCount:0,campaignCount:1},
 {id:'32',name:'Wheel of X',directCount:2,campaignCount:3},
 {id:'436',name:'Traffic Company',directCount:4,campaignCount:0},
];

describe('affiliate picker pins',()=>{
 it('parses only unique bounded string ids',()=>{
  expect(parseAffiliatePins('["436","190","436",7,"x" ]')).toEqual(['436','190','x']);
  expect(parseAffiliatePins('broken')).toEqual([]);
 });
 it('pins and unpins like a chat list',()=>{
  expect(toggleAffiliatePin(['190'],'436')).toEqual(['190','436']);
  expect(toggleAffiliatePin(['190','436'],'190')).toEqual(['436']);
 });
 it('shows pinned partners first and filters by id or name',()=>{
  expect(sortAffiliateChoices(partners,['436'],'').map(x=>x.id)).toEqual(['436','190','32']);
  expect(sortAffiliateChoices(partners,['436'],'wheel').map(x=>x.id)).toEqual(['32']);
  expect(sortAffiliateChoices(partners,['436'],'190').map(x=>x.id)).toEqual(['190']);
 });
 it('filters partners by available Smartlink or Direct-Link inventory',()=>{
  expect(filterAffiliateChoices(partners,'all').map(x=>x.id)).toEqual(['190','32','436']);
  expect(filterAffiliateChoices(partners,'smartlinks').map(x=>x.id)).toEqual(['190','32']);
  expect(filterAffiliateChoices(partners,'direct').map(x=>x.id)).toEqual(['32','436']);
 });
});
