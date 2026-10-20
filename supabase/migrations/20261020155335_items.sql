-- Placeholder core list for the app shell: each user sees and writes only their own rows.
-- user_id defaults to auth.uid(), so typing only the title saves an item.
create table public.items (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  created_at timestamptz not null default now()
);
alter table public.items enable row level security;
create policy "own items" on public.items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index items_user_id_idx on public.items (user_id);
