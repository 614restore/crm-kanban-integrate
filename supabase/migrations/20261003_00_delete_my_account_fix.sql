-- Target: llamtjsquoqlejznmyjl (TrussCENTER / TrussCTR shared backend).
--
-- delete_my_account() is the single account-deletion path for BOTH the web app and the mobile app.
--
-- Before: it ran `delete from auth.users`, which fails for anyone who ever created a quote, uploaded a
-- company file, sent an invite or completed a work-order task. Those columns point at the user's
-- team_members row; quotes.created_by is NOT NULL but its foreign key is ON DELETE SET NULL, and the
-- other three are NO ACTION, so the delete errored out and the account could not be deleted.
--
-- After:
--   * Last member of a company: the company and everything in it is deleted first.
--   * Other members remain: the company's records stay. Quotes the user created are handed to the
--     oldest remaining owner (or oldest member if there is no owner); the nullable columns are cleared.
--   * Then the login (auth user) is deleted, which removes the team_members row, notifications and
--     push tokens as before.
--
-- Safe to run more than once. Changes no data by itself.

create or replace function public.delete_my_account()
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'auth'
as $function$
declare
  v_uid uuid := auth.uid();
  v_tm record;
  v_successor uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  for v_tm in
    select id, company_id from public.team_members where user_id = v_uid
  loop
    select id into v_successor
    from public.team_members
    where company_id = v_tm.company_id and id <> v_tm.id
    order by (role = 'owner') desc, created_at asc
    limit 1;

    if v_successor is null then
      -- Last member: the workspace goes with the account.
      delete from public.companies where id = v_tm.company_id;
    else
      -- Others remain: keep the company's records, move what pointed at this person.
      update public.quotes          set created_by   = v_successor where created_by   = v_tm.id;
      update public.company_files   set uploaded_by  = null        where uploaded_by  = v_tm.id;
      update public.team_invites    set invited_by   = null        where invited_by   = v_tm.id;
      update public.work_order_tasks set completed_by = null       where completed_by = v_tm.id;
    end if;
  end loop;

  delete from auth.users where id = v_uid;
end;
$function$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

notify pgrst, 'reload schema';
