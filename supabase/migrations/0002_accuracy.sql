-- Accuracy tracking + independent verification.
--
-- Every question is recorded with the numbers behind it, so the confidence
-- floor can be tuned from evidence instead of guesswork. Every answer is then
-- re-read by a second model that never saw the question being written.

create table if not exists queries (
  id             bigserial primary key,
  question       text not null,
  corpus_chunks  int  not null default 0,
  candidates     int  not null default 0,
  admitted       int  not null default 0,
  floor          real not null,
  top_score      real,                    -- best similarity seen, admitted or not
  refused        boolean not null,
  answer         text,                    -- filled in once the stream finishes
  passage_ids    bigint[] not null default '{}',
  rating         smallint,                -- +1 / -1 from the reader, null = unrated
  created_at     timestamptz not null default now()
);

create index if not exists queries_created_at_idx on queries (created_at desc);

-- One row per verification pass. Kept separate from `queries` so a verifier
-- can be re-run later with a better prompt or model without losing history.
create table if not exists verifications (
  id           bigserial primary key,
  query_id     bigint not null references queries(id) on delete cascade,
  model        text not null,
  agrees       boolean not null,
  supported    int not null default 0,
  unsupported  int not null default 0,
  contradicted int not null default 0,
  claims       jsonb not null default '[]'::jsonb,
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists verifications_query_id_idx on verifications (query_id);

-- Score distribution for tuning SIMILARITY_FLOOR. Buckets every top_score by
-- whether the answer was ultimately rated good, so you can see where the real
-- boundary sits rather than where you guessed it was.
create or replace view floor_evidence as
  select
    width_bucket(top_score, 0, 1, 20) as bucket,
    round((width_bucket(top_score, 0, 1, 20) - 1) * 0.05, 2) as score_from,
    count(*)                                        as total,
    count(*) filter (where not refused)              as answered,
    count(*) filter (where rating = 1)               as rated_good,
    count(*) filter (where rating = -1)              as rated_bad
  from queries
  where top_score is not null
  group by 1, 2
  order by 1;
