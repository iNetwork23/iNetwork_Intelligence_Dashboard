import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {rankNestedSourceMatches,rankSourceMatches} from './source-search';

const rows=[
 {id:'partial',source:'newsletter-campaign',subSource:'creative-17'},
 {id:'exact',source:'P-3591625022',subSource:'creative-17'},
 {id:'other',source:'campaign-a',subSource:'creative-b'},
];

describe('source search',()=>{
 it('finds source and sub-source values case-insensitively and ranks exact values first',()=>{
  expect(rankSourceMatches(rows,'p-3591625022',row=>[row.source,row.subSource]).map(row=>row.id)).toEqual(['exact']);
  expect(rankSourceMatches(rows,'CREATIVE-17',row=>[row.source,row.subSource]).map(row=>row.id)).toEqual(['partial','exact']);
 });

 it('accepts a pasted source/sub-source pair',()=>{
  expect(rankSourceMatches(rows,'P-3591625022 / creative-17',row=>[row.source,row.subSource]).map(row=>row.id)).toEqual(['exact']);
 });

 it('keeps only exact matching child rows even when the same text partially matches the parent',()=>{
  const groups=[{sourceId:'foo-source',leaves:[{subSource:'foo'},{subSource:'other'}]}];
  expect(rankNestedSourceMatches(groups,'foo',group=>group.sourceId,leaf=>leaf.subSource)).toEqual([{sourceId:'foo-source',leaves:[{subSource:'foo'}]}]);
  expect(rankNestedSourceMatches(groups,'foo-source / foo',group=>group.sourceId,leaf=>leaf.subSource)).toEqual([{sourceId:'foo-source',leaves:[{subSource:'foo'}]}]);
  expect(rankNestedSourceMatches(groups,'foo-source',group=>group.sourceId,leaf=>leaf.subSource)).toEqual(groups);
  const splitAcrossSiblings=[{sourceId:'parent',leaves:[{subSource:'foo'},{subSource:'bar'}]}];
  expect(rankNestedSourceMatches(splitAcrossSiblings,'foo bar',group=>group.sourceId,leaf=>leaf.subSource)).toEqual([]);
 });

 it('uses nested matching in the operational SourceBreakdown',()=>{
  const source=readFileSync(join(process.cwd(),'src/app/affiliates/SourceBreakdown.tsx'),'utf8');
  expect(source).toContain('rankNestedSourceMatches(');
 });

 it('filters operational source controls from the immediate query without a deferred stale-action window',()=>{
  const breakdown=readFileSync(join(process.cwd(),'src/app/affiliates/SourceBreakdown.tsx'),'utf8');
  const smartlink=readFileSync(join(process.cwd(),'src/app/components/SmartlinkPresentation.tsx'),'utf8');
  expect(breakdown).toContain('allGroups,\n        query,');
  expect(breakdown).not.toContain('deferredQuery');
  expect(smartlink).toContain('rankSourceMatches(sorted,query');
  expect(smartlink).not.toContain('deferredQuery');
 });

 it('returns every row for a blank query and no rows for an unknown source',()=>{
  expect(rankSourceMatches(rows,'',row=>[row.source,row.subSource])).toEqual(rows);
  expect(rankSourceMatches(rows,'does-not-exist',row=>[row.source,row.subSource])).toEqual([]);
 });

 it('persists each coexisting finder under its own URL key',()=>{
  const source=readFileSync(join(process.cwd(),'src/app/components/SourceSearchField.tsx'),'utf8');
  expect(source).toContain('`sourceQuery_${scopeId}`');
  expect(source).not.toContain("get('sourceQuery')");
 });

 it('keeps the selected detail attached to a currently visible ranking row',()=>{
  const source=readFileSync(join(process.cwd(),'src/app/components/SmartlinkPresentation.tsx'),'utf8');
  expect(source).toContain('visible.find(row=>sourceRowKey(row)===selectedKey)||visible[0]');
  expect(source).not.toContain('matched.find(row=>sourceRowKey(row)===selectedKey)');
 });
});
