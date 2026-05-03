-- Minimal Supabase schema for Cambrian storage fallback.
-- Create these tables in your Supabase project (SQL editor).

create table if not exists public.json_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.genomes (
  genome_id text primary key,
  storage_key text,
  genome jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.memory (
  id bigserial primary key,
  genome_id text not null,
  record jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists memory_genome_created_idx on public.memory (genome_id, created_at desc);

