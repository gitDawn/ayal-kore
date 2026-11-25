-- What visitors search for in the catalog. No personal details: only the search itself
-- and how many books it found. Anyone can add a row; only staff can read or delete.
create table if not exists public.search_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  q text not null default '' check (char_length(q) <= 200),
  field text check (field in ('all', 'title', 'author')),
  category text check (char_length(category) <= 100),
  condition text check (char_length(condition) <= 50),
  max_price numeric check (max_price >= 0 and max_price < 100000),
  results integer not null check (results >= 0)
);
create index if not exists search_log_created_at on public.search_log (created_at desc);

alter table public.search_log enable row level security;
drop policy if exists "anyone logs searches" on public.search_log;
create policy "anyone logs searches" on public.search_log for insert to anon, authenticated with check (true);
drop policy if exists "staff reads searches" on public.search_log;
create policy "staff reads searches" on public.search_log for select to authenticated using (public.is_staff());
drop policy if exists "staff deletes searches" on public.search_log;
create policy "staff deletes searches" on public.search_log for delete to authenticated using (public.is_staff());
grant insert on public.search_log to anon, authenticated;
grant select, delete on public.search_log to authenticated;

-- Searches grouped by text for the last N days (runs with the caller's rights, so only staff get rows).
create or replace function public.search_stats(days integer default 30)
returns table (q text, searches bigint, zero_results bigint, last_results integer, last_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select lower(btrim(regexp_replace(s.q, '\s+', ' ', 'g'))) as q,
         count(*) as searches,
         count(*) filter (where s.results = 0) as zero_results,
         (array_agg(s.results order by s.created_at desc))[1] as last_results,
         max(s.created_at) as last_at
  from public.search_log s
  where s.created_at > now() - make_interval(days => days)
    and btrim(s.q) <> ''
  group by 1
  order by 2 desc, 5 desc
  limit 500;
$$;
revoke all on function public.search_stats(integer) from public, anon;
grant execute on function public.search_stats(integer) to authenticated;
