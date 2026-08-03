select public.refresh_ltv_cohorts_v1() as refresh_result;

select value
from public.sync_state
where key = 'ltv_cohorts_materialized';
