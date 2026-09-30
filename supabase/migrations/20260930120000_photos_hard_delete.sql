-- Photo delete is permanent: the row goes, then its two Storage files. See SPEC.md "Photo flows → Delete".

-- Soft delete is gone; dropping the column also drops the partial index built on it.
alter table photos drop column if exists deleted_at;

create index if not exists photos_project_id_idx on photos(project_id);

-- Also bump the project's updated_at when one of its photos is deleted.
-- security definer: runs as the owner, because anon can't update projects directly.
create or replace function touch_project() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update projects set updated_at = now() where id = old.project_id;
  else
    update projects set updated_at = now() where id = new.project_id;
  end if;

  return null;
end;
$$;

drop trigger if exists photos_touch_project on photos;
create trigger photos_touch_project
  after insert or update or delete on photos
  for each row execute function touch_project();

-- Photos table: anyone can delete a photo row (the app has no login).
drop policy if exists "Anyone can delete photos" on photos;
create policy "Anyone can delete photos"
  on photos for delete
  to anon
  using (true);

grant delete on photos to anon;

-- Storage: a file can only be removed once its photo row is gone, so live photos never lose their files.
drop policy if exists "Anyone can delete files of deleted photos" on storage.objects;
create policy "Anyone can delete files of deleted photos"
  on storage.objects for delete
  to anon
  using (
    bucket_id = 'photos'
    and not exists (
      select 1 from public.photos
      where photos.storage_path = storage.objects.name
        or photos.thumb_path = storage.objects.name
    )
  );
