-- Photos: triggers, anon access, and the public Storage bucket. See SPEC.md "Data model", "Row Level Security and permissions" and "Storage".

-- Triggers --------------------------------------------------------------

-- Keep projects.updated_at current when photos are added, replaced, or deleted.
-- security definer: runs as the owner, because anon can't update projects directly.
create or replace function touch_project() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update projects set updated_at = now() where id = new.project_id;
  return new;
end;
$$;

drop trigger if exists photos_touch_project on photos;
create trigger photos_touch_project
  after insert or update on photos
  for each row execute function touch_project();

-- Stamp photos.updated_at on every change; the app's cache-busting URLs depend on it.
create or replace function set_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists photos_set_updated_at on photos;
create trigger photos_set_updated_at
  before update on photos
  for each row execute function set_updated_at();

create index if not exists photos_project_id_idx on photos(project_id) where deleted_at is null;

-- Photos table access ---------------------------------------------------

alter table photos enable row level security;

drop policy if exists "Anyone can view photos" on photos;
create policy "Anyone can view photos"
  on photos for select
  to anon
  using (true);

-- Paths must follow {project_id}/{photo_id}, so a row can only point at its own files.
drop policy if exists "Anyone can add photos" on photos;
create policy "Anyone can add photos"
  on photos for insert
  to anon
  with check (
    storage_path = project_id::text || '/' || id::text
    and thumb_path = project_id::text || '/' || id::text || '_thumb'
  );

-- Replace and soft delete; the column grants below limit what an update can change.
drop policy if exists "Anyone can update photo files" on photos;
create policy "Anyone can update photo files"
  on photos for update
  to anon
  using (true)
  with check (true);

-- The id is generated in the browser so files can be uploaded before the row exists.
revoke insert on photos from anon;
grant insert (id, project_id, storage_path, thumb_path, file_name, mime_type, size_bytes, width, height)
  on photos to anon;

revoke update on photos from anon;
grant update (file_name, mime_type, size_bytes, width, height, deleted_at)
  on photos to anon;

-- Rows are never deleted from the app; delete is a soft delete via deleted_at.
revoke delete on photos from anon;

-- Storage bucket ----------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  true,
  15728640, -- 15 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage access ----------------------------------------------------------

-- Object names must be {project_id}/{photo_id} or {project_id}/{photo_id}_thumb for an existing project.
create or replace function public.is_valid_photo_object_name(object_name text) returns boolean
language sql
stable
set search_path = public
as $$
  select object_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(_thumb)?$'
    and exists (
      select 1 from projects where id::text = split_part(object_name, '/', 1)
    );
$$;

-- Needed for upsert on replace; public URLs work without it.
drop policy if exists "Anyone can read photo files" on storage.objects;
create policy "Anyone can read photo files"
  on storage.objects for select
  to anon
  using (bucket_id = 'photos');

drop policy if exists "Anyone can upload photo files" on storage.objects;
create policy "Anyone can upload photo files"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'photos' and public.is_valid_photo_object_name(name));

-- Replace overwrites the same path with upsert.
drop policy if exists "Anyone can replace photo files" on storage.objects;
create policy "Anyone can replace photo files"
  on storage.objects for update
  to anon
  using (bucket_id = 'photos')
  with check (bucket_id = 'photos' and public.is_valid_photo_object_name(name));

-- No delete policy: files are never removed from the app.
