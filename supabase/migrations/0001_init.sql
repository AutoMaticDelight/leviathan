-- Leviathan: closed-universe retrieval over your own PDFs.
-- Paste this whole file into the Supabase SQL editor and run it once.

create extension if not exists vector;

-- One row per PDF you drop in.
create table if not exists documents (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  page_count  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- One row per chunk. `embedding` is the chunk's meaning as 1536 numbers.
-- Dimension must match the model in lib/config.ts (text-embedding-3-small = 1536).
create table if not exists chunks (
  id           bigserial primary key,
  document_id  uuid not null references documents(id) on delete cascade,
  ordinal      int  not null,          -- position within the document
  page         int  not null,          -- 1-indexed PDF page, for citations
  content      text not null,
  embedding    vector(1536) not null
);

create index if not exists chunks_document_id_idx on chunks (document_id);

-- Approximate-nearest-neighbour index. Build it AFTER you have a few thousand
-- rows; on an empty table it does nothing useful.
-- TODO(you): once you have real volume, compare recall with and without this.
create index if not exists chunks_embedding_idx
  on chunks using hnsw (embedding vector_cosine_ops);

-- The retrieval query, as a function so the app sends one round trip.
-- `<=>` is cosine DISTANCE (0 = identical), so similarity = 1 - distance.
create or replace function match_chunks (
  query_embedding vector(1536),
  match_count     int default 8
)
returns table (
  id          bigint,
  document_id uuid,
  title       text,
  page        int,
  content     text,
  similarity  float
)
language sql stable
as $$
  select
    c.id,
    c.document_id,
    d.title,
    c.page,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  join documents d on d.id = c.document_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- This prototype talks to Postgres only through the service-role key on the
-- server, so RLS is left off. The moment you add sign-in, turn it on:
--   alter table documents enable row level security;
--   alter table chunks    enable row level security;
-- and scope both tables by owner.
