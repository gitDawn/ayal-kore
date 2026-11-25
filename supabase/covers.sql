-- האיל הקורא: תמונות כריכה
-- טבלה שמתעדת לכל ספר אם יש לו כריכה ומאיפה, ומאגר תמונות ציבורי לקריאה.
-- כתיבה רק לאנשי צוות. אפשר להריץ שוב בלי נזק.

create table if not exists public.book_covers (
  book_key text primary key,
  title text,
  author text,
  path text,                 -- קובץ התמונה במאגר covers, או ריק אם אין כריכה
  source text not null,      -- google / staff / none (חיפשנו ולא נמצא) / removed (הצוות הסיר)
  google_id text,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

create index if not exists book_covers_has_path on public.book_covers (book_key) where path is not null;

alter table public.book_covers enable row level security;

drop policy if exists "anyone reads book covers" on public.book_covers;
create policy "anyone reads book covers" on public.book_covers
  for select to anon, authenticated using (true);

drop policy if exists "staff inserts book covers" on public.book_covers;
create policy "staff inserts book covers" on public.book_covers
  for insert to authenticated with check (public.is_staff());

drop policy if exists "staff updates book covers" on public.book_covers;
create policy "staff updates book covers" on public.book_covers
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff deletes book covers" on public.book_covers;
create policy "staff deletes book covers" on public.book_covers
  for delete to authenticated using (public.is_staff());

create or replace function public.touch_book_covers()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists book_covers_touch on public.book_covers;
create trigger book_covers_touch
  before insert or update on public.book_covers
  for each row execute function public.touch_book_covers();

-- מאגר תמונות ציבורי, עד 200 קילובייט לתמונה, רק תמונות
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 204800, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = 204800,
  allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

drop policy if exists "staff uploads covers" on storage.objects;
create policy "staff uploads covers" on storage.objects
  for insert to authenticated with check (bucket_id = 'covers' and public.is_staff());

drop policy if exists "staff updates covers" on storage.objects;
create policy "staff updates covers" on storage.objects
  for update to authenticated using (bucket_id = 'covers' and public.is_staff())
  with check (bucket_id = 'covers' and public.is_staff());

drop policy if exists "staff deletes covers" on storage.objects;
create policy "staff deletes covers" on storage.objects
  for delete to authenticated using (bucket_id = 'covers' and public.is_staff());

-- נדרש כדי לשמור תמונה במצב החלפה ולמחוק תמונות ישנות
drop policy if exists "staff reads covers" on storage.objects;
create policy "staff reads covers" on storage.objects
  for select to authenticated using (bucket_id = 'covers' and public.is_staff());
