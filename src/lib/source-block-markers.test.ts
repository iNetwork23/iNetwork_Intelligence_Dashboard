import{describe,expect,it}from'vitest';
import{blockMarkerText,countActiveBlocks,findBlockMarker,partitionBlockedCandidates,sourceBlockMarkerIndex,sourceRowBlockKeys,type SourceBlockMarkerIndex}from'./source-block-markers';
import{normalizeSourceBlockInput,sourceBlockIdentityKey,type SourceBlockRecord}from'./source-blocks';

/** Genau die Eingabe, die SourceBlockButton für diese Zeile an /api/source-blocks senden würde. */
const buttonKey=(input:{affiliateId:string;offerId:string;trafficMode:'tracked'|'api';level:'main_source'|'sub_source';mainValue:string|null;subValue?:string|null})=>sourceBlockIdentityKey(normalizeSourceBlockInput({affiliateId:input.affiliateId,affiliateName:'Partner',offerId:input.offerId,offerName:'Offer',trafficMode:input.trafficMode,level:input.level,mainValue:input.mainValue,subValue:input.subValue}));
const record=(overrides:Partial<SourceBlockRecord>&Pick<SourceBlockRecord,'id'|'status'>):SourceBlockRecord=>({affiliateId:154,affiliateName:'Partner',offerId:20,offerName:'Offer',originCampaignId:null,trafficMode:'tracked',level:'sub_source',mainField:'source_id',mainValue:'Source A',subField:'sub1',subValue:'sub-1',variables:[],reason:'',effectiveAt:'2026-09-03T08:15:00.000Z',createdAt:'2026-09-03T08:15:00.000Z',createdBy:'admin',updatedAt:'2026-09-03T08:15:00.000Z',updatedBy:'admin',everflowSettingId:1,lastVerifiedAt:null,error:null,...overrides});
const indexOf=(...records:SourceBlockRecord[]):SourceBlockMarkerIndex=>sourceBlockMarkerIndex(new Map(records.map(item=>[sourceBlockIdentityKey(item),item])));

describe('Sperr-Schlüssel je Zeile (identisch zur Button-Eingabe)',()=>{
 it('leitet für tracked und api, Haupt- und Unterquelle denselben Schlüssel ab wie sourceBlockIdentityKey nach Normalisierung',()=>{
  for(const trafficMode of['tracked','api'] as const){
   const main={affiliateId:'154',offerId:'20',trafficMode,mainValue:'P-3591625022'};
   expect(sourceRowBlockKeys(main)).toEqual([buttonKey({...main,level:'main_source'})]);
   const sub={...main,subValue:'creative-17'};
   expect(sourceRowBlockKeys(sub)).toEqual([buttonKey({...sub,level:'sub_source'}),buttonKey({...main,level:'main_source'})]);
  }
 });
 it('behandelt Platzhalter und Leerzeichen wie die Server-Normalisierung',()=>{
  const row={affiliateId:'154',offerId:'20',trafficMode:'tracked' as const,mainValue:' Ohne Source-ID '};
  expect(sourceRowBlockKeys(row)).toEqual([buttonKey({...row,level:'main_source',mainValue:null})]);
  expect(sourceRowBlockKeys({...row,mainValue:'  src ',subValue:'N/A'})).toEqual([buttonKey({...row,mainValue:'src',level:'main_source'})]);
  expect(sourceRowBlockKeys({...row,mainValue:'src',subValue:'Ohne Sub-Source'})).toHaveLength(1);
 });
 it('liefert keinen Schlüssel für ungültige IDs',()=>{expect(sourceRowBlockKeys({affiliateId:'x',offerId:'20',trafficMode:'tracked',mainValue:'a'})).toEqual([])});
});

describe('Marker-Index',()=>{
 it('ist serialisierbar und trägt Status, Wirksamkeit, Id und Scope',()=>{
  const index=indexOf(record({id:'b1',status:'active'}));
  expect(JSON.parse(JSON.stringify(index))).toEqual(index);
  expect(Object.values(index)).toEqual([{id:'b1',status:'active',effectiveAt:'2026-09-03T08:15:00.000Z',affiliateId:'154',offerId:'20'}]);
 });
 it('findet die Sperre der Unterquelle und deckt Unterquellen über eine Hauptquellen-Sperre ab',()=>{
  const subOnly=indexOf(record({id:'b1',status:'active'}));
  const row={affiliateId:'154',offerId:'20',trafficMode:'tracked' as const,mainValue:'Source A'};
  expect(findBlockMarker(subOnly,{...row,subValue:'sub-1'})?.id).toBe('b1');
  expect(findBlockMarker(subOnly,{...row,subValue:'sub-2'})).toBeNull();
  expect(findBlockMarker(subOnly,row)).toBeNull();
  const mainBlocked=indexOf(record({id:'m1',status:'active',level:'main_source',subValue:null}));
  expect(findBlockMarker(mainBlocked,{...row,subValue:'sub-2'})?.id).toBe('m1');
  expect(findBlockMarker(mainBlocked,row)?.id).toBe('m1');
 });
 it('ignoriert inaktive Datensätze und fremde Offers, meldet error und pending als unklar',()=>{
  const row={affiliateId:'154',offerId:'20',trafficMode:'tracked' as const,mainValue:'Source A',subValue:'sub-1'};
  expect(findBlockMarker(indexOf(record({id:'b1',status:'inactive'})),row)).toBeNull();
  expect(findBlockMarker(indexOf(record({id:'b1',status:'active',offerId:21})),row)).toBeNull();
  expect(findBlockMarker(indexOf(record({id:'b1',status:'active'})),{...row,trafficMode:'api'})).toBeNull();
  expect(blockMarkerText(findBlockMarker(indexOf(record({id:'b1',status:'error'})),row)!)).toBe('Zustand unklar');
  expect(blockMarkerText(findBlockMarker(indexOf(record({id:'b1',status:'pending'})),row)!)).toBe('Verifizierung läuft');
  expect(findBlockMarker(undefined,row)).toBeNull();
 });
 it('formatiert „Gesperrt seit“ mit Berliner Datum',()=>{
  expect(blockMarkerText({id:'b1',status:'active',effectiveAt:'2026-09-03T22:30:00.000Z',affiliateId:'154',offerId:'20'})).toBe('Gesperrt seit 04.09.2026');
  expect(blockMarkerText({id:'b1',status:'inactive',effectiveAt:'2026-09-03T22:30:00.000Z',affiliateId:'154',offerId:'20'})).toBeNull();
 });
});

describe('Kandidaten-Filter',()=>{
 const candidate=(sub:string|null,mainValue='Source A')=>({affiliateId:'154',offerId:'20',trafficMode:'tracked' as const,mainValue,subValue:sub,name:`${mainValue}/${sub??'-'}`});
 it('blendet nur aktiv gesperrte Einheiten aus, lässt unklare sichtbar und zählt die ausgeblendeten',()=>{
  const index=indexOf(record({id:'b1',status:'active'}),record({id:'b2',status:'error',subValue:'sub-2'}),record({id:'b3',status:'inactive',subValue:'sub-3'}));
  const {visible,hidden}=partitionBlockedCandidates([candidate('sub-1'),candidate('sub-2'),candidate('sub-3'),candidate(null,'Source B')],index);
  expect(hidden.map(item=>item.name)).toEqual(['Source A/sub-1']);
  expect(visible.map(item=>item.name)).toEqual(['Source A/sub-2','Source A/sub-3','Source B/-']);
 });
 it('blendet alle Unterquellen einer aktiv gesperrten Hauptquelle aus',()=>{
  const index=indexOf(record({id:'m1',status:'active',level:'main_source',subValue:null}));
  const {visible,hidden}=partitionBlockedCandidates([candidate('sub-1'),candidate('sub-2'),candidate(null,'Source B')],index);
  expect(hidden).toHaveLength(2);expect(visible.map(item=>item.name)).toEqual(['Source B/-']);
 });
 it('ändert ohne Index nichts',()=>{const items=[candidate('sub-1')];expect(partitionBlockedCandidates(items,undefined)).toEqual({visible:items,hidden:[]})});
 it('zählt aktive Sperren je Affiliate und Offer für LP-Zeilen',()=>{
  const index=indexOf(record({id:'b1',status:'active'}),record({id:'b2',status:'active',subValue:'sub-2'}),record({id:'b3',status:'error',subValue:'sub-3'}),record({id:'b4',status:'active',offerId:21}));
  expect(countActiveBlocks(index,'154','20')).toBe(2);expect(countActiveBlocks(index,'154','21')).toBe(1);expect(countActiveBlocks(index,'155','20')).toBe(0);expect(countActiveBlocks(undefined,'154','20')).toBe(0);
 });
});
