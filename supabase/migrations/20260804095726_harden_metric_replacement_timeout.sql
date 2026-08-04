begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter function public.replace_metric_window(date,date,jsonb)
  set statement_timeout = '240s';
alter function public.replace_metric_window(date,date,jsonb)
  set lock_timeout = '5s';

revoke all on function public.replace_metric_window(date,date,jsonb) from public, anon, authenticated;
grant execute on function public.replace_metric_window(date,date,jsonb) to service_role;
commit;
