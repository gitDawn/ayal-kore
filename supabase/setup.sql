-- האיל הקורא: הגדרת השרת ב-Supabase
-- מריצים פעם אחת ב-SQL Editor של הפרויקט.

-- 1. רשימת המורשים לעדכן מלאי
create table if not exists public.staff (
  email text primary key
);

insert into public.staff (email) values
  ('shahar8@gmail.com'),
  ('ayalmer@gmail.com')
on conflict do nothing;

alter table public.staff enable row level security;

-- משתמש מחובר יכול לבדוק רק אם הוא עצמו ברשימה. אין הרשאת כתיבה לאף אחד דרך האתר.
drop policy if exists "staff read own row" on public.staff;
create policy "staff read own row" on public.staff
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to anon, authenticated;

-- 2. גרסאות המלאי: כל אחד קורא, רק מורשים כותבים
create table if not exists public.inventory_versions (
  id uuid primary key default gen_random_uuid(),
  file_path text not null,
  row_count integer not null check (row_count >= 0),
  source_file_name text,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create index if not exists inventory_versions_created_at on public.inventory_versions (created_at desc);

alter table public.inventory_versions enable row level security;

drop policy if exists "anyone reads versions" on public.inventory_versions;
create policy "anyone reads versions" on public.inventory_versions
  for select to anon, authenticated using (true);

drop policy if exists "staff inserts versions" on public.inventory_versions;
create policy "staff inserts versions" on public.inventory_versions
  for insert to authenticated with check (public.is_staff());

drop policy if exists "staff updates versions" on public.inventory_versions;
create policy "staff updates versions" on public.inventory_versions
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff deletes versions" on public.inventory_versions;
create policy "staff deletes versions" on public.inventory_versions
  for delete to authenticated using (public.is_staff());

-- 3. אחסון קבצי המלאי: קריאה ציבורית, העלאה ומחיקה רק למורשים
insert into storage.buckets (id, name, public)
values ('inventory', 'inventory', true)
on conflict (id) do update set public = true;

drop policy if exists "staff uploads inventory files" on storage.objects;
create policy "staff uploads inventory files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'inventory' and public.is_staff());

drop policy if exists "staff updates inventory files" on storage.objects;
create policy "staff updates inventory files" on storage.objects
  for update to authenticated
  using (bucket_id = 'inventory' and public.is_staff())
  with check (bucket_id = 'inventory' and public.is_staff());

drop policy if exists "staff deletes inventory files" on storage.objects;
create policy "staff deletes inventory files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'inventory' and public.is_staff());
