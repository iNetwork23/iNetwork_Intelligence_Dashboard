import{describe,expect,it,vi}from'vitest';
import{renderToStaticMarkup}from'react-dom/server';
vi.mock('next/navigation',()=>({usePathname:()=>'/sources',useSearchParams:()=>new URLSearchParams('range=30d'),useRouter:()=>({push:vi.fn()})}));
import SourceCandidateList from'@/app/sources/SourceCandidateList';
import{DEFAULT_SOURCE_CANDIDATE_FILTERS,prepareSourceCandidateRows}from'@/lib/source-candidate-view';
import type{SourceCandidate}from'@/lib/source-candidates';
import type{SourceBlockRecord}from'@/lib/source-blocks';
import{sourceCandidateBlockKey,sourceCandidateDomId}from'@/lib/source-candidate-link';
const candidate=(over:Partial<SourceCandidate>={}):SourceCandidate=>({affiliateId:'436',affiliate:'Partner Alpha',offerId:'12',offer:'Offer Zwölf',offerUrlId:'7',offerUrl:'Landing B',trafficMode:'tracked',level:'main_source',mainValue:'fb-camp',subValue:null,action:'AUSSCHALTEN',severity:'critical',reason:'50 SOIs ohne Sale',clicks:900,sois:60,firstSales:0,rebills:0,revenue:10,payout:120,profit:-110,lastLeadDate:'2026-09-03',leadStatus:'Heute aktiv',...over});
const record=(over:Partial<SourceBlockRecord>={}):SourceBlockRecord=>({id:'blk-1',status:'active',affiliateId:436,affiliateName:'Partner Alpha',offerId:12,offerName:'Offer Zwölf',originCampaignId:null,trafficMode:'tracked',level:'main_source',mainField:'source_id',mainValue:'fb-camp',subField:'sub1',subValue:null,variables:[],reason:'',effectiveAt:'2026-09-01T10:00:00.000Z',createdAt:'2026-09-01T10:00:00.000Z',createdBy:'u1',updatedAt:'2026-09-01T10:00:00.000Z',updatedBy:'u1',everflowSettingId:5,lastVerifiedAt:null,error:null,...over});
const render=(rows:SourceCandidate[],index:Map<string,SourceBlockRecord>,options:{finance:boolean;mayBlock:boolean;openKey?:string|null})=>renderToStaticMarkup(<SourceCandidateList rows={prepareSourceCandidateRows(rows,index,{finance:options.finance})} range="30d" openKey={options.openKey??null} initialFilters={DEFAULT_SOURCE_CANDIDATE_FILTERS} initialSort="profit" mayBlock={options.mayBlock} finance={options.finance}/>);
describe('SourceCandidateList render',()=>{
 it('renders every column with the AUSSCHALTEN verdict, reason and lead status',()=>{
  const html=render([candidate()],new Map(),{finance:true,mayBlock:true});
  for(const text of['Partner Alpha','#436','Offer Zwölf · #12','Landing B','fb-camp','AUSSCHALTEN','50 SOIs ohne Sale','Heute aktiv','120,00','-110,00','reif · 60 SOIs'])expect(html).toContain(text);
  expect(html).toContain(`id="${sourceCandidateDomId(candidate())}"`);
  expect(html).toContain('Source fb-camp: Vergütung sperren');expect(html).toContain('type="checkbox"');
 });
 it('hides money without finance.view and every block action without manage rights',()=>{
  const html=render([candidate()],new Map(),{finance:false,mayBlock:false});
  expect(html).not.toContain('120,00');expect(html).not.toContain('-110,00');expect(html).not.toContain('<th scope="col">Payout</th>');expect(html).not.toContain('Vergütung sperren</span>');expect(html).not.toContain('type="checkbox"');expect(html).toContain('Nicht gesperrt');
 });
 it('shows blocked rows as "Gesperrt seit" with the audit link and without checkbox or block button',()=>{
  const base=candidate(),html=render([base],new Map([[sourceCandidateBlockKey(base),record()]]),{finance:true,mayBlock:true});
  expect(html).toContain('Gesperrt seit 01.09.2026');expect(html).toContain('href="/source-blocks"');expect(html).not.toContain('type="checkbox"');expect(html).not.toContain('Source fb-camp: Vergütung sperren');
 });
 it('highlights the deep-linked row even when it sits outside the top 50',()=>{
  const rows=Array.from({length:60},(_,i)=>candidate({offerUrlId:String(i),profit:-i,mainValue:`src-${i}`}));
  const target=rows[0],openKey=prepareSourceCandidateRows([target],new Map(),{finance:true})[0].key;
  const html=render(rows,new Map(),{finance:true,mayBlock:false,openKey});
  expect(html).toContain('class="sourcesOpenRow"');expect(html).toContain(`id="${sourceCandidateDomId(target)}"`);expect(html).toContain('Weitere 9 von 9 Quellen anzeigen');
 });
 it('explains an empty rollup and a filter without matches',()=>{
  expect(render([],new Map(),{finance:true,mayBlock:true})).toContain('Keine Quelle mit Handlungsbedarf im Rollup.');
 });
});
