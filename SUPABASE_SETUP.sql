-- Create the auctions table
create table public.auctions (
  id text primary key,
  recinto text not null,
  fecha text not null,
  "totalAnimales" int4 not null,
  "totalKilos" float8 not null,
  lots jsonb not null,
  summaries jsonb,
  created_at timestamptz default now()
);

-- ============================================
-- MIGRATION: Run this if the table already exists
-- ============================================
-- ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS summaries jsonb;

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

-- ============================================
-- LIVE STREAMING - Tables for live auctions
-- ============================================

-- Table for live streams
create table public.live_streams (
  id uuid primary key default gen_random_uuid(),
  youtube_url text not null,
  title text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Enable RLS for live_streams
alter table public.live_streams enable row level security;

-- Allow public read access to streams
create policy "Allow public read streams"
  on public.live_streams
  for select
  using (true);

-- Allow all operations for authenticated users
create policy "Allow all for authenticated on streams"
  on public.live_streams
  for all
  to authenticated
  using (true);

-- Table for stream comments
create table public.stream_comments (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid references public.live_streams(id) on delete cascade,
  author_name text not null,
  message text not null,
  created_at timestamptz default now()
);

-- Enable RLS for stream_comments
alter table public.stream_comments enable row level security;

-- Allow public read access to comments
create policy "Allow public read comments"
  on public.stream_comments
  for select
  using (true);

-- Allow public to insert comments (anyone can comment)
create policy "Allow public insert comments"
  on public.stream_comments
  for insert
  with check (true);

-- Enable Realtime for comments (run this in Supabase dashboard if needed)
-- alter publication supabase_realtime add table stream_comments;
