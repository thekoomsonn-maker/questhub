-- Whether a seller has opted in to sharing their phone. Reveals only a
-- boolean, so listing pages can show the "Show phone number" button to
-- visitors before they sign in; the number itself still needs a session.
create or replace function public.seller_shares_phone(p_seller uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select show_phone and phone is not null
      from public.profile_contacts c
      join public.profiles p on p.id = c.user_id
     where c.user_id = p_seller and p.status = 'active'
  ), false);
$$;

grant execute on function public.seller_shares_phone(uuid) to anon, authenticated;
