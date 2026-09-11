// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {assertBerlinReportingRange} from './berlin-reporting-contract';
import DashboardPage from '../app/page';

const fixture=vi.hoisted(()=>({
  user:{id:'local-qa',access:{role:'super_admin'}} as unknown,
  allowed:true,
  failure:null as unknown,
  query:'period=30d&view=affiliates&company=Example',
  push:vi.fn(),
  load:vi.fn(),
}));
vi.mock('@/lib/session',()=>({currentUser:async()=>fixture.user}));
vi.mock('@/lib/rbac',()=>({can:()=>fixture.allowed}));
vi.mock('@/lib/dashboard-service',()=>({getHomeDashboard:(...args:unknown[])=>{fixture.load(...args);return Promise.reject(fixture.failure)}}));
vi.mock('@/lib/leitstand',()=>({loadLeitstand:async()=>({})}));
vi.mock('next/navigation',()=>({
  redirect:(href:string)=>{throw new Error('REDIRECT '+href)},
  usePathname:()=>'/',
  useSearchParams:()=>new URLSearchParams(fixture.query),
  useRouter:()=>({push:fixture.push}),
}));

let root:Root|undefined,host:HTMLDivElement;
beforeEach(()=>{
  vi.stubGlobal('React',React);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.spyOn(console,'error').mockImplementation(()=>{});
  vi.spyOn(console,'warn').mockImplementation(()=>{});
  fixture.user={id:'local-qa',access:{role:'super_admin'}};
  fixture.allowed=true;fixture.query='period=30d&view=affiliates&company=Example';
  fixture.push.mockClear();fixture.load.mockClear();
  document.documentElement.dataset.locale='de';
  host=document.createElement('div');document.body.append(host);
});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;host.remove();vi.restoreAllMocks();vi.unstubAllGlobals()});

async function missingRangeError(from='2026-08-10',to='2026-09-08'){
  const q={select:()=>q,gte:()=>q,lte:()=>q,order:async()=>({data:[],error:null})};
  try{await assertBerlinReportingRange({from:()=>q} as never,{from,to})}catch(error){return error}
  throw new Error('Missing markers unexpectedly accepted');
}
async function mount(query:Record<string,string>={period:'30d',view:'affiliates',company:'Example'}){
  const tree=await DashboardPage({searchParams:Promise.resolve(query)});
  await act(async()=>{root=createRoot(host);root.render(tree)});
}

describe('account period recovery after a rejected data load',()=>{
  it('keeps period selection usable when Berlin day proofs are missing, preserving view and company',async()=>{
    fixture.failure=await missingRangeError();await mount();
    expect(host.textContent).toContain('Zeitraum noch nicht vollständig verfügbar');
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    const week=[...host.querySelectorAll('button')].find(button=>button.textContent==='7 Tage');
    expect(week).toBeDefined();await act(async()=>week!.click());
    expect(fixture.push).toHaveBeenCalledWith('/?view=affiliates&company=Example&period=7d',{scroll:false});
    expect(host.querySelector('table')).toBeNull();
    expect(host.textContent).not.toContain('0 €');
  });
  it('retries the selected custom range and view rather than resetting to the default',async()=>{
    fixture.failure=new Error('Database unavailable internal-private-detail');
    const query={period:'custom',from:'2026-08-28',to:'2026-09-02',view:'paths',company:'A&B'};
    fixture.query=new URLSearchParams(query).toString();await mount(query);
    const retry=host.querySelector<HTMLAnchorElement>('a[data-dashboard-retry]');
    expect(retry).not.toBeNull();
    expect(new URL(retry!.href).searchParams.toString()).toBe(new URLSearchParams(query).toString());
    expect(host.textContent).toContain('Dashboard konnte nicht geladen werden');
    expect(host.textContent).not.toContain('internal-private-detail');
    expect(host.querySelector('input[name="from"]')?.getAttribute('value')??host.querySelector('input[type="date"]')?.getAttribute('value')).toBe('2026-08-28');
  });
  it('offers recovery for invalid custom dates without throwing another range error',async()=>{
    fixture.failure=new Error('Ungültiger freier Zeitraum');
    fixture.query='period=custom&from=invalid&to=2026-09-02';
    await mount({period:'custom',from:'invalid',to:'2026-09-02'});
    expect([...host.querySelectorAll('button')].some(button=>button.textContent==='Heute')).toBe(true);
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.textContent).toContain('Ungültiger Zeitraum');
    expect(host.textContent).toContain('Bitte ein gültiges Von- und Bis-Datum auswählen.');
    expect(host.textContent).not.toContain('Datenquelle ist vorübergehend nicht verfügbar');
    expect(host.querySelector('[data-dashboard-retry]')).toBeNull();
  });
  it('identifies the reversed dates from the native Account test and preserves them for correction',async()=>{
    fixture.failure=new Error('Ungültiger freier Zeitraum');
    const query={period:'custom',from:'2026-09-11',to:'2026-09-09'};fixture.query=new URLSearchParams(query).toString();await mount(query);
    expect(host.textContent).toContain('Ungültiger Zeitraum');
    expect(host.querySelector<HTMLInputElement>('input[name="from"]')?.value).toBe(query.from);
    expect(host.querySelector<HTMLInputElement>('input[name="to"]')?.value).toBe(query.to);
    const month=[...host.querySelectorAll('button')].find(button=>button.textContent==='30 Tage')!;await act(async()=>month.click());
    expect(fixture.push).toHaveBeenCalledWith('/?period=30d',{scroll:false});
  });
  it('keeps authentication and permission denial ahead of the recovery UI',async()=>{
    fixture.user=null;await expect(mount()).rejects.toThrow('REDIRECT /login');
    fixture.user={id:'local-qa',access:{role:'partner'}};fixture.allowed=false;await mount();
    expect(host.textContent).toContain('403');
    expect(host.querySelector('[data-dashboard-retry]')).toBeNull();
    expect(fixture.load).not.toHaveBeenCalled();
  });
  it('keeps a rejected data scope separate from incomplete coverage and does not render controls',async()=>{
    fixture.failure=new Error('403 scope verification failed');await mount();
    expect(host.textContent).toContain('403 · Scope nicht sicher auswertbar');
    expect(host.querySelector('[data-dashboard-retry]')).toBeNull();
    expect(host.querySelector('.periodControls')).toBeNull();
  });
  it('uses a typed coverage failure while retaining the exact missing-day rejection',async()=>{
    const error=await missingRangeError();
    expect(error).toMatchObject({name:'IncompleteBerlinReportingRangeError',confirmedDays:0,totalDays:30});
    expect(String(error)).toContain('0/30 Tage bestätigt');
  });
  it('does not confuse a 403-day incomplete reporting range with an authorization failure',async()=>{
    fixture.failure=await missingRangeError('2025-08-02','2026-09-08');
    expect(String(fixture.failure)).toContain('0/403 Tage bestätigt');
    await mount({period:'custom',from:'2025-08-02',to:'2026-09-08'});
    expect(host.textContent).toContain('Zeitraum noch nicht vollständig verfügbar');
    expect(host.querySelector('[data-dashboard-retry]')).not.toBeNull();
    expect(host.textContent).not.toContain('403 · Scope');
  });
});
