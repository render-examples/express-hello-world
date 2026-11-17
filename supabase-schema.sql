-- Run this SQL in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  plan text not null default 'free' check (plan in ('free','paid')),
  monthly_ai_requests integer not null default 0,
  monthly_ai_limit integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  company text not null default '',
  status text not null default 'Lead' check (status in ('Lead','Active')),
  created_at timestamptz not null default now()
);
create index if not exists contacts_owner_created_idx on public.contacts(owner_id,created_at desc);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_subscription_id text unique not null,
  status text not null,
  price_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions(user_id);

alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.subscriptions enable row level security;

create policy "Users can read own profile" on public.profiles for select using (auth.uid()=id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid()=id) with check (auth.uid()=id);
create policy "Users can manage own contacts" on public.contacts for all using (auth.uid()=owner_id) with check (auth.uid()=owner_id);
create policy "Users can read own subscriptions" on public.subscriptions for select using (auth.uid()=user_id);

-- Automatically create a profile whenever Supabase Auth creates a user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Monthly usage reset should be scheduled using Supabase Cron or a trusted server scheduler.
-- Do not expose a client-side function that can reset usage or change plan entitlements.
