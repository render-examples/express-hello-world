-- NEXORA AI compatibility migration
-- Run this AFTER the earlier SQL setup shared in the ChatGPT conversation.
-- It preserves existing rows and adds the columns expected by server.js.

create extension if not exists pgcrypto;

-- Profiles: add backend usage and plan fields.
alter table public.profiles
  add column if not exists email text,
  add column if not exists plan text not null default 'free',
  add column if not exists monthly_ai_requests integer not null default 0,
  add column if not exists monthly_ai_limit integer not null default 100;

-- Contacts: preserve existing user_id values and mirror them into owner_id.
alter table public.contacts
  add column if not exists owner_id uuid,
  add column if not exists status text not null default 'Lead';

update public.contacts
set owner_id = user_id
where owner_id is null;

-- Add the owner foreign key only if it does not already exist.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contacts_owner_id_fkey'
      and conrelid = 'public.contacts'::regclass
  ) then
    alter table public.contacts
      add constraint contacts_owner_id_fkey
      foreign key (owner_id) references auth.users(id) on delete cascade;
  end if;
end $$;

alter table public.contacts alter column owner_id set not null;
create index if not exists contacts_owner_created_idx
  on public.contacts(owner_id, created_at desc);

-- Existing subscriptions table: add fields expected by the Paddle webhook.
alter table public.subscriptions
  add column if not exists price_id text,
  add column if not exists updated_at timestamptz not null default now();

-- Allows webhook upsert by provider_subscription_id; NULL values remain allowed.
create unique index if not exists subscriptions_provider_subscription_id_uidx
  on public.subscriptions(provider_subscription_id);

-- Keep the profile row in sync with new Auth signups.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- RLS remains enabled; this additional policy matches the backend's owner_id field.
alter table public.contacts enable row level security;
drop policy if exists "NEXORA contacts owner access" on public.contacts;
create policy "NEXORA contacts owner access"
on public.contacts for all
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);
