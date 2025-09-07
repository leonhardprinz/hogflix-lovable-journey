-- Create a minimal, non-sensitive projection table for listing profiles safely
create table if not exists public.profiles_public (
  id uuid primary key,
  display_name text,
  is_kids_profile boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint profiles_public_id_fkey
    foreign key (id)
    references public.profiles(id)
    on delete cascade
);

-- Ensure RLS is enabled
alter table public.profiles_public enable row level security;

-- RLS: allow authenticated users to view all rows (no sensitive fields present)
create policy if not exists "Public profiles are viewable by authenticated users"
  on public.profiles_public
  for select
  to authenticated
  using (true);

-- Do NOT allow inserts/updates/deletes from clients (no policies for those)

-- Trigger function to sync profiles -> profiles_public
create or replace function public.sync_profiles_public()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.profiles_public (id, display_name, is_kids_profile, created_at, updated_at)
    values (new.id, new.display_name, new.is_kids_profile, new.created_at, new.updated_at)
    on conflict (id) do update set
      display_name = excluded.display_name,
      is_kids_profile = excluded.is_kids_profile,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at;
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into public.profiles_public (id, display_name, is_kids_profile, created_at, updated_at)
    values (new.id, new.display_name, new.is_kids_profile, new.created_at, new.updated_at)
    on conflict (id) do update set
      display_name = excluded.display_name,
      is_kids_profile = excluded.is_kids_profile,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at;
    return new;
  elsif (tg_op = 'DELETE') then
    delete from public.profiles_public where id = old.id;
    return old;
  end if;
  return null;
end;
$$;

-- Triggers on profiles to keep the public table in sync
-- Use AFTER triggers so timestamps are finalized
create or replace trigger profiles_sync_public_aiud
  after insert or update on public.profiles
  for each row execute function public.sync_profiles_public();

create or replace trigger profiles_sync_public_ad
  after delete on public.profiles
  for each row execute function public.sync_profiles_public();

-- Backfill existing rows into profiles_public
insert into public.profiles_public (id, display_name, is_kids_profile, created_at, updated_at)
select id, display_name, is_kids_profile, created_at, updated_at
from public.profiles
on conflict (id) do update set
  display_name = excluded.display_name,
  is_kids_profile = excluded.is_kids_profile,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;
