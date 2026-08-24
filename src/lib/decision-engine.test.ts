import {describe,expect,it} from 'vitest';
import {assessUnit,projectSourceAction,wilsonLower,wilsonUpper} from './decision-engine';

const m=(x:Partial<Parameters<typeof assessUnit>[0]>)=>({clicks:0,sois:0,firstSales:0,rebills:0,profit:0,...x});

describe('wilson interval',()=>{
  it('bounds a rate between 0 and 1 and brackets the point estimate',()=>{
    const lower=wilsonLower(3,20),upper=wilsonUpper(3,20);
    expect(lower).toBeGreaterThan(0);
    expect(upper).toBeLessThan(1);
    expect(lower).toBeLessThan(3/20);
    expect(upper).toBeGreaterThan(3/20);
  });
  it('returns 0 bounds for an empty sample',()=>{
    expect(wilsonLower(0,0)).toBe(0);
    expect(wilsonUpper(0,0)).toBe(0);
  });
  it('gives zero successes in fifty trials an upper bound near seven percent',()=>{
    const upper=wilsonUpper(0,50);
    expect(upper).toBeGreaterThan(0.05);
    expect(upper).toBeLessThan(0.09);
  });
});

describe('unified decision engine',()=>{
  it('kills dead traffic: a hundred clicks without a single soi',()=>{
    expect(assessUnit(m({clicks:120}))).toMatchObject({action:'AUSSCHALTEN',severity:'critical'});
  });
  it('kills fifty sois without a first sale at negative profit',()=>{
    expect(assessUnit(m({sois:55,profit:-80}))).toMatchObject({action:'AUSSCHALTEN'});
  });
  it('does not kill mature negative traffic that has first sales and no benchmark',()=>{
    expect(assessUnit(m({sois:80,firstSales:4,profit:-30}))).toMatchObject({action:'BEOBACHTEN',severity:'warning'});
  });
  it('kills underperformance only when even the optimistic rate is below half the benchmark',()=>{
    // 1/100 = 1% Punktrate, Obergrenze ~5.4% — Benchmark 8%: Halbwert 4% < 5.4% → überlebt
    expect(assessUnit(m({sois:100,firstSales:1,profit:-10}),{benchmarkRate:0.08})).toMatchObject({action:'BEOBACHTEN'});
    // 1/400: Obergrenze ~1.4% < 4% → fällt
    expect(assessUnit(m({sois:400,firstSales:1,profit:-10}),{benchmarkRate:0.08})).toMatchObject({action:'AUSSCHALTEN'});
  });
  it('scales only with three independent first sales and positive profit',()=>{
    expect(assessUnit(m({sois:25,firstSales:3,profit:40}))).toMatchObject({action:'SKALIEREN',severity:'positive'});
    expect(assessUnit(m({sois:25,firstSales:2,profit:40}))).toMatchObject({action:'WEITERLAUFEN'});
    expect(assessUnit(m({sois:25,firstSales:3,profit:-5}))).not.toMatchObject({action:'SKALIEREN'});
  });
  it('keeps young traffic in testing instead of judging it',()=>{
    expect(assessUnit(m({clicks:40,sois:5}))).toMatchObject({action:'WEITER TESTEN',severity:'neutral'});
  });
  it('watches when there is nothing to evaluate',()=>{
    expect(assessUnit(m({}))).toMatchObject({action:'BEOBACHTEN'});
  });
  it('evaluates api traffic without clicks on the soi gate',()=>{
    expect(assessUnit(m({sois:55,profit:-80}),{api:true})).toMatchObject({action:'AUSSCHALTEN'});
    expect(assessUnit(m({sois:5,profit:-3}),{api:true})).toMatchObject({action:'WEITER TESTEN'});
  });
});

describe('source projection',()=>{
  it('maps the five actions onto the three source actions consistently',()=>{
    expect(projectSourceAction('AUSSCHALTEN')).toBe('ABSCHALTEN');
    expect(projectSourceAction('SKALIEREN')).toBe('SKALIEREN');
    for(const action of ['WEITERLAUFEN','WEITER TESTEN','BEOBACHTEN'] as const)
      expect(projectSourceAction(action)).toBe('BEOBACHTEN');
  });
});

describe('level parity',()=>{
  it('source verdicts are always the projection of the shared engine — the two levels can no longer contradict each other',async()=>{
    const {assessTraffic}=await import('./source-breakdown');
    const cases=[
      {clicks:120,sois:0,firstSales:0,rebills:0,profit:-10},
      {clicks:80,sois:20,firstSales:0,rebills:0,profit:-1},
      {clicks:200,sois:60,firstSales:0,rebills:0,profit:-90},
      {clicks:200,sois:25,firstSales:3,rebills:1,profit:40},
      {clicks:500,sois:400,firstSales:1,rebills:0,profit:-10},
      {clicks:40,sois:5,firstSales:0,rebills:0,profit:2},
    ];
    for(const c of cases)for(const benchmark of [undefined,0.08]){
      const source=assessTraffic({...c,cvr:0,firstSaleRate:0,coinSpend:0,payout:0,revenue:0,profitPerSoi:0},benchmark);
      const engine=projectSourceAction(assessUnit(c,{benchmarkRate:benchmark}).action);
      expect(source.action).toBe(engine);
    }
  });
});
