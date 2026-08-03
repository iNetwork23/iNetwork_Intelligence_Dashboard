export type LtvCohort={registration_month:string;source_id:string;sub_source:string;registrations:number;revenue_30d:number;revenue_60d:number;revenue_90d:number;revenue_180d:number;revenue_365d:number};
type CohortPage={data:Record<string,unknown>[]|null;error:{message:string}|null};
type CohortQuery={order(column:string,options?:{ascending?:boolean}):CohortQuery;eq(column:string,value:string):CohortQuery;range(from:number,to:number):PromiseLike<CohortPage>};
export type CohortClient={from(table:string):{select(columns:string):CohortQuery}};

// PostgREST liefert pro Anfrage höchstens 1000 Zeilen. Ohne Paginierung würde die
// Kohortentabelle ab dieser Grenze ohne Fehlermeldung abgeschnitten.
export const COHORT_PAGE_SIZE=1_000;
export const COHORT_MAX_ROWS=100_000;

const toNumber=(value:unknown)=>Number(value||0);

export async function getLtvCohorts(client:CohortClient,filters:{source?:string;subSource?:string}={}):Promise<LtvCohort[]>{
  const rows:Record<string,unknown>[]=[];
  for(let offset=0;offset<COHORT_MAX_ROWS;offset+=COHORT_PAGE_SIZE){
    // sub_source vervollständigt die Sortierung, damit die Seitengrenzen stabil bleiben.
    let query=client.from('ltv_cohorts').select('*').order('registration_month',{ascending:false}).order('source_id').order('sub_source');
    if(filters.source)query=query.eq('source_id',filters.source);
    if(filters.subSource)query=query.eq('sub_source',filters.subSource);
    const {data,error}=await query.range(offset,offset+COHORT_PAGE_SIZE-1);
    if(error)throw new Error(`Supabase ltv_cohorts: ${error.message}`);
    const page=data||[];
    rows.push(...page);
    if(page.length<COHORT_PAGE_SIZE)break;
  }
  return rows.map(row=>({
    ...row,registrations:toNumber(row.registrations),revenue_30d:toNumber(row.revenue_30d),revenue_60d:toNumber(row.revenue_60d),
    revenue_90d:toNumber(row.revenue_90d),revenue_180d:toNumber(row.revenue_180d),revenue_365d:toNumber(row.revenue_365d),
  })) as LtvCohort[];
}
