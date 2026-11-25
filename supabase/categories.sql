-- האיל הקורא: קטגוריות ערוכות לספרים
-- מריצים פעם אחת ב-SQL Editor. אפשר להריץ שוב בלי נזק.

-- ספר מזוהה לפי שם + מחבר (מנורמלים). העריכה נשמרת גם אחרי העלאת קובץ מלאי חדש.
create table if not exists public.book_categories (
  book_key text primary key,
  title text not null,
  author text,
  categories text[] not null default '{}',
  subcategories text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

alter table public.book_categories enable row level security;

drop policy if exists "anyone reads book categories" on public.book_categories;
create policy "anyone reads book categories" on public.book_categories
  for select to anon, authenticated using (true);

drop policy if exists "staff inserts book categories" on public.book_categories;
create policy "staff inserts book categories" on public.book_categories
  for insert to authenticated with check (public.is_staff());

drop policy if exists "staff updates book categories" on public.book_categories;
create policy "staff updates book categories" on public.book_categories
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff deletes book categories" on public.book_categories;
create policy "staff deletes book categories" on public.book_categories
  for delete to authenticated using (public.is_staff());

-- עדכון אוטומטי של זמן העריכה
create or replace function public.touch_book_categories()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists book_categories_touch on public.book_categories;
create trigger book_categories_touch
  before insert or update on public.book_categories
  for each row execute function public.touch_book_categories();
