\set ON_ERROR_STOP 1
create temp table results (n serial, check_name text, ok boolean);
grant all on results to authenticated; grant usage on sequence results_n_seq to authenticated;
create or replace function pg_temp.as_user(u uuid) returns void language sql as $$ select set_config('test.uid', u::text, false) $$;

-- each case runs as role authenticated and is always rolled back, so cases are independent.
-- returns rows affected, or -1 if the statement raised an error (e.g. RLS refused an insert)
create or replace function pg_temp.try(u text, sql text) returns int language plpgsql as $$
declare n int;
begin
  begin
    perform set_config('test.uid', u, true);
    execute 'set local role authenticated';
    execute sql; get diagnostics n = row_count;
    raise exception 'rc:%', n;
  exception when others then
    if sqlerrm like 'rc:%' then return substr(sqlerrm, 4)::int; end if;
    return -1;
  end;
end $$;

\set A '''a0000000-0000-0000-0000-00000000000a'''
\set B '''b0000000-0000-0000-0000-00000000000b'''
\set REP '''00000000-0000-0000-0000-0000000000a1'''
\set SELFPROMO '''00000000-0000-0000-0000-0000000000a2'''
\set MGR '''00000000-0000-0000-0000-0000000000a3'''
\set INACTIVE_OWNER '''00000000-0000-0000-0000-0000000000a4'''
\set OTHER_MGR '''00000000-0000-0000-0000-0000000000b1'''

insert into payments (id, company_id, amount) values
 ('11111111-0000-0000-0000-000000000001', :A, 100), ('11111111-0000-0000-0000-000000000002', :B, 200);

insert into results (check_name, ok) values
 ('sales_rep reads own company payments (1 row)',      pg_temp.try(:REP, 'select * from payments') = 1),
 ('manager reads own company payments (1 row)',        pg_temp.try(:MGR, 'select * from payments') = 1),
 ('sales_rep inserts into own company',                pg_temp.try(:REP, $q$insert into payments (company_id, amount) values ('a0000000-0000-0000-0000-00000000000a', 5)$q$) = 1),
 ('manager inserts into own company',                  pg_temp.try(:MGR, $q$insert into payments (company_id, amount) values ('a0000000-0000-0000-0000-00000000000a', 6)$q$) = 1),
 ('sales_rep cannot insert into other company',        pg_temp.try(:REP, $q$insert into payments (company_id, amount) values ('b0000000-0000-0000-0000-00000000000b', 7)$q$) = -1),
 ('sales_rep updates own company payment',             pg_temp.try(:REP, $q$update payments set notes = 'x' where id = '11111111-0000-0000-0000-000000000001'$q$) = 1),
 ('sales_rep cannot move payment to other company',    pg_temp.try(:REP, $q$update payments set company_id = 'b0000000-0000-0000-0000-00000000000b' where id = '11111111-0000-0000-0000-000000000001'$q$) = -1),
 ('sales_rep cannot update other company payment',     pg_temp.try(:REP, $q$update payments set notes = 'x' where id = '11111111-0000-0000-0000-000000000002'$q$) = 0),
 ('no user: reads nothing',                            pg_temp.try('', 'select * from payments') = 0);
-- delete cases each in their own savepoint so one delete does not hide the row from the next
insert into results (check_name, ok) values ('DELETE sales_rep', pg_temp.try(:REP, $q$delete from payments where id = '11111111-0000-0000-0000-000000000001'$q$) = :expect_rep_delete);
insert into results (check_name, ok) values ('DELETE rep with profiles.role=manager', pg_temp.try(:SELFPROMO, $q$delete from payments where id = '11111111-0000-0000-0000-000000000001'$q$) = :expect_rep_delete);
insert into results (check_name, ok) values ('DELETE inactive owner', pg_temp.try(:INACTIVE_OWNER, $q$delete from payments where id = '11111111-0000-0000-0000-000000000001'$q$) = :expect_rep_delete);
insert into results (check_name, ok) values ('DELETE sales_manager deletes own company payment', pg_temp.try(:MGR, $q$delete from payments where id = '11111111-0000-0000-0000-000000000001'$q$) = 1);
insert into results (check_name, ok) values ('DELETE manager cannot delete other company payment', pg_temp.try(:OTHER_MGR, $q$delete from payments where id = '11111111-0000-0000-0000-000000000001'$q$) = 0);
select check_name, case when ok then 'PASS' else 'FAIL' end from results order by n;
select count(*) filter (where not ok) as failures from results;
