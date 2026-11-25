-- Cover image links shown directly from another site (Simania), for books without a stored cover.
-- Public read: only the book key and the image address, no prices or market data.
create table if not exists public.book_cover_links (
  book_key text primary key,
  url text not null,
  source text not null default 'simania',
  updated_at timestamptz not null default now()
);
alter table public.book_cover_links enable row level security;
drop policy if exists "anyone reads cover links" on public.book_cover_links;
create policy "anyone reads cover links" on public.book_cover_links for select using (true);
drop policy if exists "staff writes cover links" on public.book_cover_links;
create policy "staff writes cover links" on public.book_cover_links for insert to authenticated with check (public.is_staff());
drop policy if exists "staff updates cover links" on public.book_cover_links;
create policy "staff updates cover links" on public.book_cover_links for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff deletes cover links" on public.book_cover_links;
create policy "staff deletes cover links" on public.book_cover_links for delete to authenticated using (public.is_staff());

-- Fill from the Simania import: the most recently updated copy of each book.
insert into public.book_cover_links (book_key, url)
select distinct on (book_key) book_key, cover_url
from public.simania_items
where cover_url is not null
order by book_key, simania_updated_at desc nulls last
on conflict (book_key) do update set url = excluded.url, updated_at = now();

select count(*) as links from public.book_cover_links;
