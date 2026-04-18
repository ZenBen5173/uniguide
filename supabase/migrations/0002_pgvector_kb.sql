-- Knowledge base for procedure SOPs.
-- SOPs are split into chunks (~500 tokens each) and embedded for retrieval-augmented planning.

create table if not exists public.procedure_sop_chunks (
  id uuid primary key default gen_random_uuid(),
  procedure_id text not null references public.procedures(id) on delete cascade,
  chunk_order int not null,
  section text,                    -- optional section header (e.g., "Eligibility")
  content text not null,
  source_url text,
  embedding vector(1536),          -- adjust to GLM/embedding model dimension when wiring
  indexed_at timestamptz not null default now()
);

-- IVFFlat index for kNN search; tune lists based on row count.
create index if not exists procedure_sop_chunks_embedding_idx
  on public.procedure_sop_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists procedure_sop_chunks_procedure_idx
  on public.procedure_sop_chunks(procedure_id);

-- Helper: kNN retrieval scoped to a procedure
create or replace function public.match_sop_chunks(
  query_embedding vector(1536),
  procedure_id_filter text,
  match_count int default 5
)
returns table (
  id uuid,
  procedure_id text,
  section text,
  content text,
  source_url text,
  similarity float
)
language sql stable
as $$
  select
    c.id,
    c.procedure_id,
    c.section,
    c.content,
    c.source_url,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.procedure_sop_chunks c
  where c.procedure_id = procedure_id_filter
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
