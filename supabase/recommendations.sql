-- Recommendations page: a Facebook video with the books from it. Everyone reads published ones; staff manage.
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  text text check (char_length(text) <= 1000),
  video_url text not null check (video_url ~ '^https://(www\.facebook\.com|fb\.watch)/' and char_length(video_url) <= 300),
  vertical boolean not null default true,
  book_ids text[] not null default '{}' check (cardinality(book_ids) <= 60),
  position integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recommendations enable row level security;
drop policy if exists "anyone reads published recommendations" on public.recommendations;
create policy "anyone reads published recommendations" on public.recommendations for select to anon, authenticated using (published or public.is_staff());
drop policy if exists "staff adds recommendations" on public.recommendations;
create policy "staff adds recommendations" on public.recommendations for insert to authenticated with check (public.is_staff());
drop policy if exists "staff edits recommendations" on public.recommendations;
create policy "staff edits recommendations" on public.recommendations for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff removes recommendations" on public.recommendations;
create policy "staff removes recommendations" on public.recommendations for delete to authenticated using (public.is_staff());
grant select on public.recommendations to anon, authenticated;
grant insert, update, delete on public.recommendations to authenticated;

-- The first recommendation, until now written in the site code.
insert into public.recommendations (title, video_url, vertical, book_ids, position)
select 'כלכלה מכל הכיוונים', 'https://www.facebook.com/reel/1622604586299663', true,
       array['15ed069c5740','ac05bc9a9d0a','6ffadf12fb7c','482e9a701182','0182d1f2c4a3','61bfef210fb7'], 0
where not exists (select 1 from public.recommendations where video_url = 'https://www.facebook.com/reel/1622604586299663');
