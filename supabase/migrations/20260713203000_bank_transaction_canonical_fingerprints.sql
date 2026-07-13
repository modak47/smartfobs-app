create or replace function public.smartfobs_fnv1a_32(input text)
returns text
language plpgsql
immutable
as $$
declare
  hash bigint := 2166136261;
  code integer;
  position integer;
begin
  for position in 1..length(coalesce(input, '')) loop
    code := ascii(substr(input, position, 1));
    hash := mod(((hash # code::bigint)::numeric * 16777619), 4294967296)::bigint;
  end loop;

  return lpad(to_hex(hash), 8, '0');
end;
$$;

alter table if exists public.smartfobs_bank_transactions
  add column if not exists canonical_base_hash text,
  add column if not exists occurrence_index integer,
  add column if not exists canonical_fingerprint_version integer not null default 1;

with canonical_sources as (
  select
    id,
    coalesce(transaction_date::date::text, '') || '|' ||
      trim(regexp_replace(
        lower(regexp_replace(coalesce(description, ''), '[^[:alnum:]]+', ' ', 'g')),
        '\s+',
        ' ',
        'g'
      )) || '|' ||
      coalesce(round((amount * 100))::bigint::text, '') || '|' ||
      case
        when amount > 0 then 'incoming'
        when amount < 0 then 'outgoing'
        else 'zero'
      end as canonical_source
  from public.smartfobs_bank_transactions
),
normalised as (
  select
    id,
    'sf_base_' || public.smartfobs_fnv1a_32(canonical_source) as canonical_base_hash
  from canonical_sources
),
numbered as (
  select
    t.id,
    n.canonical_base_hash,
    row_number() over (
      partition by n.canonical_base_hash
      order by t.transaction_date, t.created_at nulls last, t.id
    ) as occurrence_index
  from public.smartfobs_bank_transactions t
  join normalised n on n.id = t.id
)
update public.smartfobs_bank_transactions t
set
  canonical_base_hash = numbered.canonical_base_hash,
  occurrence_index = numbered.occurrence_index,
  transaction_hash = numbered.canonical_base_hash || '_' || lpad(numbered.occurrence_index::text, 3, '0'),
  canonical_fingerprint_version = 1,
  updated_at = now()
from numbered
where t.id = numbered.id;

create index if not exists smartfobs_bank_transactions_canonical_base_idx
  on public.smartfobs_bank_transactions(canonical_base_hash);

create index if not exists smartfobs_bank_transactions_canonical_occurrence_idx
  on public.smartfobs_bank_transactions(canonical_base_hash, occurrence_index);

-- Intentionally no unique constraint here. HSBC can contain genuine repeated
-- same-day transactions with the same description and amount; the app handles
-- occurrence counts during import.
