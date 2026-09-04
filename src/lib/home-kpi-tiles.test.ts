import{readFileSync}from'node:fs';
import{join}from'node:path';
import{describe,expect,it,vi}from'vitest';
import{buildHomeKpis,toneClass}from'./home-kpis';
import{maturityGateText}from'./verdict-vocabulary';
import type{Metrics}from'./portfolio';
import type{PortfolioDailyPoint}from'./supabase-reporting';
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const metrics=(x:Partial<Metrics>={}):Metrics=>({clicks:0,sois:0,cvr:0,firstSales:0,firstSaleRate:0,rebills:0,coinSpend:0,payout:0,revenue:0,profit:0,profitEpc:0,...x});
const day=(date:string,x:Partial<PortfolioDailyPoint>={}):PortfolioDailyPoint=>({date,clicks:0,sois:0,firstSales:0,rebills:0,revenue:0,payout:0,profit:0,...x});
const base={dayCount:7,dailyLimitDays:45,finance:true,periodQuery:'period=7d'};

describe('home KPI tiles (Abnahme D/G)',()=>{
 it('renders sparkline points from the daily series, a directed delta and a context link per tile',()=>{
  const totals=metrics({clicks:1200,sois:60,cvr:5,firstSales:6,rebills:3,revenue:900,payout:500,profit:400,profitEpc:0.333}),previous=metrics({clicks:1000,sois:50,cvr:5,firstSales:4,rebills:2,revenue:700,payout:450,profit:250});
  const daily=[day('2026-08-29',{profit:10,clicks:100,sois:5,revenue:50,firstSales:1}),day('2026-08-30',{profit:-5,clicks:120,sois:6,revenue:60}),day('2026-08-31',{profit:20,clicks:130,sois:7,revenue:70,firstSales:2})];
  const tiles=buildHomeKpis({...base,totals,previous,daily});
  expect(tiles.map(t=>t.key)).toEqual(['profit','revenue','clicks','sois','monetization']);
  const profit=tiles[0];
  expect(profit.hero).toBe(true);expect(profit.points).toEqual([10,-5,20]);expect(profit.sparkLabel).toBe('Profit je Tag');
  expect(profit.delta.direction).toBe('up');expect(profit.delta.text).toBe('+150,00 € (+60 %)');expect(profit.delta.reason).toBeNull();
  expect(profit.deltaTone).toBe('positive');expect(profit.valueTone).toBe('positive');expect(profit.href).toBe('/?period=7d&view=affiliates');
  expect(tiles[2].points).toEqual([100,120,130]);expect(tiles[2].delta.text).toBe('+200 (+20 %)');expect(tiles[2].href).toBe('/?period=7d&view=paths');
  expect(tiles[3].delta.text).toBe('+10 (+20 %)');expect(tiles[3].deltaLabel).toBe('Δ SOIs');expect(tiles[3].sub).toBe('CVR 5,00 % · Δ CVR 0,00 pp');
  const sales=tiles[4];expect(sales.deltaLabel).toBe('Δ First-Sales');expect(sales.delta.direction).toBe('up');expect(sales.delta.text).toBe('+2 (+50 %)');expect(sales.deltaTone).toBe('positive');expect(sales.points).toEqual([1,0,2]);expect(sales.sub).not.toContain('pp');
  const cvrUp=buildHomeKpis({...base,totals:metrics({...totals,cvr:5.25}),previous,daily});expect(cvrUp[3].sub).toBe('CVR 5,25 % · Δ CVR +0,25 pp');
  for(const tile of tiles)expect(tile.href.startsWith('/?period=7d&view=')).toBe(true);
 });
 it('keeps every sign colour neutral below the maturity gate and explains every dash',()=>{
  const totals=metrics({clicks:40,sois:3,profit:-12,revenue:20,payout:32}),previous=metrics({clicks:10,sois:1,profit:5});
  const tiles=buildHomeKpis({...base,totals,previous,daily:[day('2026-08-30',{profit:-4}),day('2026-08-31',{profit:-8})]});
  for(const tile of tiles){expect(tile.delta.text).toBe('–');expect(tile.delta.reason).toBe(maturityGateText);expect(tile.deltaTone).toBe('neutral');expect(tile.tone).toBe('neutral');expect(toneClass(tile.deltaTone)).toBe('')}
  expect(tiles[0].valueTone).toBe('neutral');expect(toneClass(tiles[0].valueTone)).toBe('');
  expect(tiles[3].sub).toBe('CVR 0,00 %');
 });
 it('drops series and previous period beyond 45 days with a stated reason instead of a bare dash',()=>{
  const tiles=buildHomeKpis({...base,dayCount:90,totals:metrics({clicks:5000,sois:200,profit:100}),previous:null,daily:undefined});
  for(const tile of tiles){expect(tile.points).toEqual([]);expect(tile.sparkLabel).toBe('Tagesreihe nur bei Fenstern bis 45 Tage');expect(tile.delta.text).toBe('–');expect(tile.delta.reason).toBe('Vorperiode nur bei Fenstern bis 45 Tage')}
  const short=buildHomeKpis({...base,totals:metrics({clicks:5000,sois:200}),previous:null,daily:undefined});
  expect(short[0].delta.reason).toBe('keine Vorperiode');expect(short[0].sparkLabel).toBe('Tagesreihe nicht verfügbar');
 });
 it('hides money tiles without finance.view and keeps volume tiles identical',()=>{
  const tiles=buildHomeKpis({...base,finance:false,totals:metrics({clicks:500,sois:30,profit:99,revenue:200}),previous:metrics({clicks:400,sois:20}),daily:[day('2026-08-30',{clicks:1}),day('2026-08-31',{clicks:2})]});
  expect(tiles.map(t=>t.key)).toEqual(['clicks','sois','monetization']);
  for(const tile of tiles){expect(tile.value).not.toContain('€');expect(tile.sub).not.toContain('€')}
 });
 it('mounts the shared Sparkline and the vocabulary helpers on the home page without a private traffic light',()=>{
  const page=read('src/app/page.tsx');
  expect(page).toContain("import Sparkline from './components/Sparkline'");
  expect(page).toContain('<Sparkline points={tile.points}');
  expect(page).toContain('buildHomeKpis(');expect(page).toContain('toneClass(');
  expect(page).not.toContain(">=0?'up':'down'");expect(page).not.toMatch(/\?'up':'down'/);
  expect(page).toContain('title={tile.delta.reason??undefined}');
  expect(page).toContain('getHomeDashboard(');
  expect(page.indexOf('<DataStatusBar')).toBeLessThan(page.indexOf('<LeitstandSection'));
  expect(page.indexOf('<LeitstandSection')).toBeLessThan(page.indexOf('<section className="kpis">'));
  expect(page).toContain('user.access.role!==\'partner\'&&<LeitstandSection');
 });
 it('loads the daily series and previous period only for windows up to 45 days and never lets them break the portfolio',async()=>{
  vi.resetModules();
  vi.doMock('server-only',()=>({}));
  vi.doMock('next/cache',()=>({unstable_cache:(load:()=>unknown)=>load}));
  vi.doMock('./supabase',()=>({getSupabaseAdmin:()=>({from:()=>({})})}));
  const loadPortfolioFromCache=vi.fn(),loadPortfolioDailyFromCache=vi.fn();
  vi.doMock('./supabase-reporting',async()=>{const actual=await vi.importActual<typeof import('./supabase-reporting')>('./supabase-reporting');return{...actual,loadPortfolioFromCache:(...a:unknown[])=>loadPortfolioFromCache(...a),loadPortfolioDailyFromCache:(...a:unknown[])=>loadPortfolioDailyFromCache(...a)}});
  const{loadHomeDashboard}=await import('./dashboard-service');
  const portfolio={range:{from:'2026-08-29',to:'2026-09-04',label:'x'},totals:metrics({clicks:10}),offers:[],affiliates:[],paths:[],generatedAt:''};
  loadPortfolioFromCache.mockResolvedValueOnce(portfolio).mockResolvedValueOnce({...portfolio,totals:metrics({clicks:4})});loadPortfolioDailyFromCache.mockResolvedValueOnce([day('2026-08-29')]);
  const now=new Date('2026-09-04T12:00:00Z'),week=await loadHomeDashboard('7d',undefined,undefined,now);
  expect(week.daily).toEqual([day('2026-08-29')]);expect(week.previous).toEqual({from:'2026-08-22',to:'2026-08-28',totals:metrics({clicks:4})});expect(week.dayCount).toBe(7);
  expect(loadPortfolioFromCache).toHaveBeenNthCalledWith(2,'custom',expect.anything(),now,{from:'2026-08-22',to:'2026-08-28'},undefined);
  loadPortfolioFromCache.mockReset();loadPortfolioDailyFromCache.mockReset();loadPortfolioFromCache.mockResolvedValueOnce(portfolio);
  const quarter=await loadHomeDashboard('90d',undefined,undefined,now);
  expect(quarter.daily).toBeUndefined();expect(quarter.previous).toBeUndefined();expect(quarter.dayCount).toBe(90);expect(loadPortfolioFromCache).toHaveBeenCalledTimes(1);expect(loadPortfolioDailyFromCache).not.toHaveBeenCalled();
  loadPortfolioFromCache.mockReset();loadPortfolioDailyFromCache.mockReset();loadPortfolioFromCache.mockResolvedValueOnce(portfolio).mockRejectedValueOnce(new Error('prev down'));loadPortfolioDailyFromCache.mockRejectedValueOnce(new Error('daily down'));
  const degraded=await loadHomeDashboard('7d',undefined,undefined,now);
  expect(degraded.totals.clicks).toBe(10);expect(degraded.daily).toBeUndefined();expect(degraded.previous).toBeUndefined();
  vi.doUnmock('./supabase-reporting');vi.doUnmock('./supabase');vi.doUnmock('next/cache');
 });
});
