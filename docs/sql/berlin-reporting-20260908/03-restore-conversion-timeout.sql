-- Revert only the separately approved function-local budget change.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

do $$
declare
  v_proc pg_proc;
begin
  select * into strict v_proc from pg_proc
  where oid = 'public.replace_conversion_window(date,date,jsonb)'::regprocedure;
  if md5(v_proc.prosrc) is distinct from '4d68797ccb3e7b90cb98fc5ab9a8564d'
     or v_proc.proconfig is distinct from array['search_path=pg_catalog, public, pg_temp','statement_timeout=45s','lock_timeout=5s']::text[]
     or v_proc.proacl::text is distinct from '{postgres=X/postgres,service_role=X/postgres}'
     or v_proc.proowner <> 'postgres'::regrole
     or not v_proc.prosecdef then
    raise exception 'conversion replacement rollback baseline changed; inspect before reverting';
  end if;
end;
$$;

alter function public.replace_conversion_window(date,date,jsonb) reset statement_timeout;
alter function public.replace_conversion_window(date,date,jsonb) reset lock_timeout;
notify pgrst, 'reload schema';
commit;
