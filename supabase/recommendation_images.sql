-- Recommendations with a picture instead of a video. The picture is stored in the public "covers"
-- bucket under rec/, and can link to the original Facebook post.
alter table public.recommendations alter column video_url drop not null;
alter table public.recommendations add column if not exists image_path text
  check (image_path ~ '^rec/[a-z0-9-]{8,64}\.(webp|jpg)$');
alter table public.recommendations add column if not exists image_width integer check (image_width between 1 and 4000);
alter table public.recommendations add column if not exists image_height integer check (image_height between 1 and 8000);
alter table public.recommendations add column if not exists post_url text
  check (post_url ~ '^https://(www\.|m\.)?facebook\.com/' and char_length(post_url) <= 300);
alter table public.recommendations drop constraint if exists recommendations_has_media;
alter table public.recommendations add constraint recommendations_has_media
  check (video_url is not null or image_path is not null);
