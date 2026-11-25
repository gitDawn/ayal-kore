-- Copies of books as listed in the store's Simania seller inventory.
-- One row per copy (Simania's owned id). Staff only: prices and market data are internal.
create table if not exists public.simania_items (
  owned_id bigint primary key,
  book_key text not null,
  simania_book_id bigint,
  title text,
  author text,
  publisher text,
  year int,
  price numeric,
  condition text,
  category text,
  subcategory text,
  cover_url text,
  simania_updated_at timestamptz,
  tags text[] not null default '{}',
  market jsonb,
  imported_at timestamptz not null default now()
);
create index if not exists simania_items_book_key on public.simania_items (book_key);

alter table public.simania_items enable row level security;
drop policy if exists "staff reads simania" on public.simania_items;
create policy "staff reads simania" on public.simania_items for select to authenticated using (public.is_staff());
drop policy if exists "staff writes simania" on public.simania_items;
create policy "staff writes simania" on public.simania_items for insert to authenticated with check (public.is_staff());
drop policy if exists "staff updates simania" on public.simania_items;
create policy "staff updates simania" on public.simania_items for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff deletes simania" on public.simania_items;
create policy "staff deletes simania" on public.simania_items for delete to authenticated using (public.is_staff());

-- Private bucket for raw import files read from Simania.
insert into storage.buckets (id, name, public) values ('imports', 'imports', false) on conflict (id) do nothing;
drop policy if exists "staff uploads imports" on storage.objects;
create policy "staff uploads imports" on storage.objects for insert to authenticated with check (bucket_id = 'imports' and public.is_staff());
drop policy if exists "staff reads imports" on storage.objects;
create policy "staff reads imports" on storage.objects for select to authenticated using (bucket_id = 'imports' and public.is_staff());
drop policy if exists "staff updates imports" on storage.objects;
create policy "staff updates imports" on storage.objects for update to authenticated using (bucket_id = 'imports' and public.is_staff());
drop policy if exists "staff deletes imports" on storage.objects;
create policy "staff deletes imports" on storage.objects for delete to authenticated using (bucket_id = 'imports' and public.is_staff());
