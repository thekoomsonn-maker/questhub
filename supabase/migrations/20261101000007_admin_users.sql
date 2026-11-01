-- Admin user directory (joins auth emails, which clients can't read directly).
create or replace function public.admin_list_users(
  p_query text default null,
  p_status public.account_status default null,
  p_role public.user_role default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid, email text, display_name text, username text, role public.user_role, status public.account_status,
  is_verified boolean, suspended_reason text, deletion_requested_at timestamptz, created_at timestamptz,
  last_sign_in_at timestamptz, listing_count bigint, open_reports bigint, total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(trim(p_query), '');
begin
  perform public.require_admin();
  return query
    select p.id, u.email::text, p.display_name, p.username, p.role, p.status, p.is_verified, p.suspended_reason,
           p.deletion_requested_at, p.created_at, u.last_sign_in_at,
           (select count(*) from public.listings l where l.seller_id = p.id),
           (select count(*) from public.reports r where r.reported_user_id = p.id and r.status in ('open', 'reviewing')),
           count(*) over ()
      from public.profiles p
      join auth.users u on u.id = p.id
     where (v_q is null or p.display_name ilike '%' || v_q || '%' or u.email ilike '%' || v_q || '%' or p.username ilike '%' || v_q || '%')
       and (p_status is null or p.status = p_status)
       and (p_role is null or p.role = p_role)
     order by p.created_at desc
     limit least(greatest(p_limit, 1), 100)
    offset greatest(p_offset, 0);
end;
$$;

revoke execute on function public.admin_list_users(text, public.account_status, public.user_role, integer, integer) from public, anon;
grant execute on function public.admin_list_users(text, public.account_status, public.user_role, integer, integer) to authenticated;
