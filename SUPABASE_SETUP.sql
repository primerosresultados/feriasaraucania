-- Create the auctions table
create table public.auctions (
  id text primary key,
  recinto text not null,
  fecha text not null,
  "totalAnimales" int4 not null,
  "totalKilos" float8 not null,
  lots jsonb not null,
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS)
alter table public.auctions enable row level security;

-- Create a policy that allows anyone to read auctions (for the widget)
create policy "Allow public read-only access"
  on public.auctions
  for select
  using (true);

-- Create a policy that allows authenticated users to insert/update/delete (for the admin panel)
-- Note: If you use Supabase Auth, you can refine this. 
-- For now, this allows anyone with the anon key to do anything if RLS is not strictly configured.
-- For production, it's better to use:
create policy "Allow all for service role or specific users"
  on public.auctions
  for all
  to authenticated
  using (true);
