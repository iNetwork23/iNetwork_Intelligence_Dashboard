import {describe,expect,it,vi} from 'vitest';
import {COHORT_PAGE_SIZE,getLtvCohorts,type CohortClient} from './cohorts';

type Row=Record<string,unknown>;
const row=(index:number):Row=>({registration_month:'2026-07-01',source_id:`s${index}`,sub_source:'',registrations:'2',revenue_30d:'10',revenue_60d:null,revenue_90d:undefined,revenue_180d:'5',revenue_365d:'7'});

/** Minimaler PostgREST-Doppelgänger: schneidet jede Seite auf COHORT_PAGE_SIZE zu. */
function fakeClient(all:Row[],error:{message:string}|null=null){
  const orders:Array<[string,{ascending?:boolean}|undefined]>=[];
  const filters:Array<[string,string]>=[];
  const ranges:Array<[number,number]>=[];
  const client:CohortClient={from:(table:string)=>{
    expect(table).toBe('ltv_cohorts');
    const builder={
      order(column:string,options?:{ascending?:boolean}){orders.push([column,options]);return builder},
      eq(column:string,value:string){filters.push([column,value]);return builder},
      range(from:number,to:number){
        ranges.push([from,to]);
        const matching=filters.length?all.filter(item=>filters.every(([column,value])=>item[column]===value)):all;
        return Promise.resolve({data:error?null:matching.slice(from,to+1),error});
      },
    };
    return{select:()=>builder};
  }};
  return{client,orders,filters,ranges};
}

describe('LTV-Kohorten',()=>{
  it('holt alle Seiten, wenn mehr als eine PostgREST-Seite vorliegt',async()=>{
    const all=Array.from({length:COHORT_PAGE_SIZE*2+3},(_,index)=>row(index));
    const {client,ranges}=fakeClient(all);
    const result=await getLtvCohorts(client);
    expect(result).toHaveLength(all.length);
    expect(ranges).toEqual([[0,COHORT_PAGE_SIZE-1],[COHORT_PAGE_SIZE,COHORT_PAGE_SIZE*2-1],[COHORT_PAGE_SIZE*2,COHORT_PAGE_SIZE*3-1]]);
  });

  it('hört nach einer unvollständigen Seite auf',async()=>{
    const {client,ranges}=fakeClient([row(0),row(1)]);
    expect(await getLtvCohorts(client)).toHaveLength(2);
    expect(ranges).toEqual([[0,COHORT_PAGE_SIZE-1]]);
  });

  it('sortiert vollständig, damit die Seitengrenzen stabil bleiben',async()=>{
    const {client,orders}=fakeClient([row(0)]);
    await getLtvCohorts(client);
    expect(orders).toEqual([['registration_month',{ascending:false}],['source_id',undefined],['sub_source',undefined]]);
  });

  it('reicht Filter an die Abfrage durch',async()=>{
    const {client,filters}=fakeClient([{...row(0),source_id:'wanted'},{...row(1),source_id:'other'}]);
    const result=await getLtvCohorts(client,{source:'wanted',subSource:''});
    expect(filters).toEqual([['source_id','wanted']]);
    expect(result).toHaveLength(1);
  });

  it('wandelt Zahlenfelder verlässlich um',async()=>{
    const {client}=fakeClient([row(0)]);
    const [first]=await getLtvCohorts(client);
    expect(first).toMatchObject({registrations:2,revenue_30d:10,revenue_60d:0,revenue_90d:0,revenue_180d:5,revenue_365d:7});
  });

  it('meldet Supabase-Fehler als Ausnahme',async()=>{
    const {client}=fakeClient([],{message:'boom'});
    await expect(getLtvCohorts(client)).rejects.toThrow('Supabase ltv_cohorts: boom');
  });

  it('erzwingt keinen zweiten Aufruf bei genau einer leeren Antwort',async()=>{
    const range=vi.fn().mockResolvedValue({data:[],error:null});
    const builder={order:()=>builder,eq:()=>builder,range};
    const client={from:()=>({select:()=>builder})} as unknown as CohortClient;
    expect(await getLtvCohorts(client)).toEqual([]);
    expect(range).toHaveBeenCalledTimes(1);
  });
});
