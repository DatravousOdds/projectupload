-- Visitors (anon) can list and create projects, but never edit or delete them. See SPEC.md "Row Level Security and permissions".

alter table projects enable row level security;

-- Reading: the list page and the insert's returned row both need this.
drop policy if exists "Anyone can view projects" on projects;
create policy "Anyone can view projects"
  on projects for select
  to anon
  using (true);

-- Creating: any row may be inserted; the column grants below limit which fields it can set.
drop policy if exists "Anyone can create projects" on projects;
create policy "Anyone can create projects"
  on projects for insert
  to anon
  with check (true);

-- Only the fields the create form sends; id and timestamps always come from the column defaults.
revoke insert on projects from anon;
grant insert (name, description) on projects to anon;

-- No update or delete policies exist, so RLS blocks both; revoking makes the intent explicit.
revoke update, delete on projects from anon;
