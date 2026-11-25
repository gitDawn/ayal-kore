-- Book descriptions (blurbs), saved from Google Books when a book is matched.
-- One row per book (same key as covers). Anyone can read; only staff can write.
create table if not exists public.book_descriptions (
  book_key text primary key,
  description text not null,
  source text not null default 'google',
  google_id text,
  updated_at timestamptz not null default now()
);
alter table public.book_descriptions enable row level security;
drop policy if exists "anyone reads descriptions" on public.book_descriptions;
create policy "anyone reads descriptions" on public.book_descriptions for select using (true);
drop policy if exists "staff writes descriptions" on public.book_descriptions;
create policy "staff writes descriptions" on public.book_descriptions for insert to authenticated with check (public.is_staff());
drop policy if exists "staff updates descriptions" on public.book_descriptions;
create policy "staff updates descriptions" on public.book_descriptions for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff deletes descriptions" on public.book_descriptions;
create policy "staff deletes descriptions" on public.book_descriptions for delete to authenticated using (public.is_staff());
grant select on public.book_descriptions to anon, authenticated;
grant insert, update, delete on public.book_descriptions to authenticated;
