-- Anyone can delete a project (the app has no login). See SPEC.md "Photo flows → Delete project".
-- Its photo rows go with it via on delete cascade; the app then removes its Storage folder,
-- which the "Anyone can delete files of deleted photos" policy allows once the rows are gone.
drop policy if exists "Anyone can delete projects" on projects;
create policy "Anyone can delete projects"
  on projects for delete
  to anon
  using (true);

grant delete on projects to anon;
