import{existsSync,readFileSync,readdirSync,statSync}from'node:fs';
import{join}from'node:path';
import{describe,expect,it}from'vitest';
import{buildPeriodQuery,DEFAULT_PERIOD,detectPeriodEditor,globalPeriodParams,periodCalendarRange,resolveGlobalPeriod,sourcesRangeFromPeriod,todayPartialNote,withGlobalPeriod}from'./period-controls';
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const walk=(dir:string):string[]=>readdirSync(dir).flatMap(name=>{const path=join(dir,name);return statSync(path).isDirectory()?walk(path):[path]});

describe('one period component with two URL dimensions (D5)',()=>{
 it('defaults to 30 days for missing or unknown periods',()=>{
  expect(DEFAULT_PERIOD).toBe('30d');
  expect(resolveGlobalPeriod(undefined)).toBe('30d');expect(resolveGlobalPeriod('bogus')).toBe('30d');expect(resolveGlobalPeriod('7d')).toBe('7d');expect(resolveGlobalPeriod('custom')).toBe('custom');
  expect(read('src/app/page.tsx')).toContain('resolveGlobalPeriod(query.period)');
  expect(read('src/app/page.tsx')).not.toMatch(/:'7d';/);
 });
 it('builds the global dimension and keeps every foreign parameter',()=>{
  const current='affiliate=376&offer=8&sourceOpen=url-1&sourceSort=cvr&view=paths&company=acme&sourcePeriod=7d&calendarYear=2026&calendarMonth=03';
  const query=new URLSearchParams(buildPeriodQuery(current,'global',{period:'custom',from:'2026-08-01',to:'2026-08-31'}));
  expect(query.get('period')).toBe('custom');expect(query.get('from')).toBe('2026-08-01');expect(query.get('to')).toBe('2026-08-31');
  for(const[key,value]of[['affiliate','376'],['offer','8'],['sourceOpen','url-1'],['sourceSort','cvr'],['view','paths'],['company','acme'],['sourcePeriod','7d']])expect(query.get(key)).toBe(value);
  expect(query.has('calendarYear')).toBe(false);expect(query.has('calendarMonth')).toBe(false);
  const preset=new URLSearchParams(buildPeriodQuery(query,'global',{period:'7d'}));
  expect(preset.get('period')).toBe('7d');expect(preset.has('from')).toBe(false);expect(preset.has('to')).toBe(false);expect(preset.get('sourcePeriod')).toBe('7d');
 });
 it('builds the source dimension without touching the global period',()=>{
  const current='period=custom&from=2026-01-01&to=2026-01-31&affiliate=376&sourceOpen=url-2';
  const calendar=new URLSearchParams(buildPeriodQuery(current,'source',{period:'calendar',from:'2026-03-01',to:'2026-03-31'}));
  expect(calendar.get('sourcePeriod')).toBe('calendar');expect(calendar.get('sourceFrom')).toBe('2026-03-01');expect(calendar.get('sourceTo')).toBe('2026-03-31');
  expect(calendar.get('period')).toBe('custom');expect(calendar.get('from')).toBe('2026-01-01');expect(calendar.get('sourceOpen')).toBe('url-2');
  const preset=new URLSearchParams(buildPeriodQuery(calendar,'source',{period:'30d'}));
  expect(preset.get('sourcePeriod')).toBe('30d');expect(preset.has('sourceFrom')).toBe(false);expect(preset.get('period')).toBe('custom');
 });
 it('resolves calendar months and whole years capped at the max date',()=>{
  expect(periodCalendarRange('2026','08','2026-09-04')).toEqual({from:'2026-08-01',to:'2026-08-31'});
  expect(periodCalendarRange('2026','09','2026-09-04')).toEqual({from:'2026-09-01',to:'2026-09-04'});
  expect(periodCalendarRange('2026','all','2026-09-04')).toEqual({from:'2026-01-01',to:'2026-09-04'});
  expect(periodCalendarRange('2025','all','2026-09-04')).toEqual({from:'2025-01-01',to:'2025-12-31'});
  expect(periodCalendarRange('2027','all','2026-09-04')).toBeNull();expect(periodCalendarRange('2026','13','2026-09-04')).toBeNull();
 });
 it('detects which editor belongs to the current selection',()=>{
  expect(detectPeriodEditor('30d',undefined,undefined,'2026-09-04')).toEqual({editor:null,year:null,month:null});
  expect(detectPeriodEditor('custom','2026-08-01','2026-08-31','2026-09-04')).toEqual({editor:'months',year:'2026',month:'08'});
  expect(detectPeriodEditor('calendar','2025-01-01','2025-12-31','2026-09-04')).toEqual({editor:'months',year:'2025',month:'all'});
  expect(detectPeriodEditor('custom','2026-08-03','2026-08-20','2026-09-04')).toEqual({editor:'custom',year:null,month:null});
 });
 it('carries the global period into internal links only when set and valid',()=>{
  expect(globalPeriodParams('view=paths')).toEqual({});
  expect(globalPeriodParams('period=7d&view=paths')).toEqual({period:'7d'});
  expect(globalPeriodParams('period=custom&from=2026-08-01&to=2026-08-31')).toEqual({period:'custom',from:'2026-08-01',to:'2026-08-31'});
  expect(globalPeriodParams('period=custom&from=2026-08-01')).toEqual({});
  expect(globalPeriodParams('period=nope')).toEqual({});
  expect(withGlobalPeriod('/affiliates','period=7d&view=paths')).toBe('/affiliates?period=7d');
  expect(withGlobalPeriod('/sources','period=custom&from=2026-08-01&to=2026-08-31')).toBe('/sources?period=custom&from=2026-08-01&to=2026-08-31');
  expect(withGlobalPeriod('/sources?range=7d#row','period=7d')).toBe('/sources?range=7d&period=7d#row');
  expect(withGlobalPeriod('/affiliates?period=90d','period=7d')).toBe('/affiliates?period=90d');
  expect(withGlobalPeriod('/affiliates','view=paths')).toBe('/affiliates');
  expect(withGlobalPeriod('https://example.com/x','period=7d')).toBe('https://example.com/x');
 });
 it('derives the /sources rollup window from the global period and keeps an explicit range',()=>{
  expect(sourcesRangeFromPeriod('7d')).toBe('7d');expect(sourcesRangeFromPeriod('30d')).toBe('30d');expect(sourcesRangeFromPeriod('today')).toBe('30d');expect(sourcesRangeFromPeriod(undefined)).toBe('30d');
  const page=read('src/app/sources/page.tsx');
  expect(page).toContain("isSourceCandidateRange(params.range)?params.range:sourcesRangeFromPeriod(params.period)");
 });
 it('marks "Heute" as a partial day up to the sync time',()=>{
  expect(todayPartialNote({todayPartial:true,syncAt:'2026-09-04T09:15:00Z'})).toBe('Teiltag bis 11:15 Uhr');
  expect(todayPartialNote({todayPartial:false,syncAt:null})).toBe('Teiltag bis Sync-Zeit');
  expect(todayPartialNote(null)).toBe('Teiltag bis Sync-Zeit');
 });
});

describe('period component consolidation (Abnahme E)',()=>{
 it('leaves exactly one period component in the repository and removes the three old ones',()=>{
  for(const old of['src/app/components/DashboardPeriodControls.tsx','src/app/affiliates/AffiliatePeriodControls.tsx','src/app/affiliates/SourcePeriodControls.tsx'])expect(existsSync(join(process.cwd(),old)),old).toBe(false);
  const components=walk(join(process.cwd(),'src/app')).filter(path=>/PeriodControls\.tsx$/.test(path));
  expect(components.map(path=>path.replace(process.cwd(),''))).toEqual(['/src/app/components/PeriodControls.tsx']);
  const controls=read('src/app/components/PeriodControls.tsx'),lib=read('src/lib/period-controls.ts');
  expect(controls).toContain("dimension:PeriodDimension");
  expect(controls).toContain('buildPeriodQuery(searchParams,dimension');
  expect(controls.match(/<form/g)).toHaveLength(1);
  for(const marker of['Heute','7 Tage','30 Tage','90 Tage','12 Monate','365 Tage'])expect(lib,marker).toContain(`'${marker}'`);
  for(const marker of['Jahr / Monat','Individuell','Ganzes Jahr','aria-label="Monate"','max={maxDate}','aria-busy={pending}','Zeitraum wird geladen …','todayNote','collectOpenSourceDetails',"query.set('sourceOpen'",'anchorId'])expect(controls,marker).toContain(marker);
  expect(controls).toContain("setCustomFrom(from??'');setCustomTo(to??'')");expect(controls).toContain('value={customFrom}');expect(controls).toContain('value={customTo}');
  expect(lib).toContain("['all','365 Tage']");expect(lib).not.toContain("'Gesamt'");
 });
 it('wires every caller to the shared component with the right dimension',()=>{
  const home=read('src/app/page.tsx'),affiliates=read('src/app/affiliates/page.tsx'),fraud=read('src/app/fraud/page.tsx'),breakdown=read('src/app/affiliates/SourceBreakdown.tsx');
  expect(home).toContain('<PeriodControls dimension="global"');expect(home).toContain('todayNote={todayPartialNote(dataStatus)}');
  expect(affiliates.match(/<PeriodControls dimension="global"/g)).toHaveLength(2);expect(affiliates).not.toContain('AffiliatePeriodControls');
  expect(fraud).toContain('<PeriodControls dimension="global"');expect(fraud).not.toContain('<select name="period"');expect(fraud).toContain('<input type="hidden" name="period"');
  expect(breakdown).toContain('<PeriodControls dimension="source"');expect(breakdown).not.toContain('SourcePeriodControls');
 });
 it('carries the global period through the sidebar so it survives a section switch',()=>{
  const sidebar=read('src/app/components/AdminSidebar.tsx');
  expect(sidebar).toContain('useSearchParams');expect(sidebar).toContain('withGlobalPeriod(item.href,searchParams)');
  expect(sidebar.match(/withGlobalPeriod\(item\.href,searchParams\)/g)).toHaveLength(2);
 });
});
