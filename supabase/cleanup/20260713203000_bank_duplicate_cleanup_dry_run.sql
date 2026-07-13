-- Dry-run duplicate cleanup report for SmartFobs bank transactions.
-- Review the output before running any generated UPDATE or DELETE statement.
-- This script does not delete data.

with ranked as (
  select
    id,
    transaction_date,
    description,
    amount,
    transaction_type,
    balance,
    bank_reference,
    source_filename,
    import_batch_id,
    transaction_hash,
    canonical_base_hash,
    occurrence_index,
    category,
    category_type,
    review_status,
    notes,
    matched_job_id,
    matched_income_id,
    matched_expense_id,
    created_at,
    updated_at,
    count(*) over (partition by canonical_base_hash, balance) as group_size,
    row_number() over (
      partition by canonical_base_hash, balance
      order by
        case when matched_job_id is not null or matched_income_id is not null or matched_expense_id is not null then 0 else 1 end,
        case when review_status = 'reviewed' then 0 else 1 end,
        case when category is not null and category not in ('Miscellaneous', 'Other Income') then 0 else 1 end,
        case when nullif(trim(coalesce(notes, '')), '') is not null then 0 else 1 end,
        created_at asc nulls last,
        id asc
    ) as survivor_rank
  from public.smartfobs_bank_transactions
  where canonical_base_hash is not null
),
duplicate_rows as (
  select *
  from ranked
  where group_size > 1
),
survivors as (
  select *
  from duplicate_rows
  where survivor_rank = 1
),
removals as (
  select *
  from duplicate_rows
  where survivor_rank > 1
)
select
  canonical_base_hash,
  count(*) as rows_in_group,
  balance,
  min(created_at) as oldest_created_at,
  max(created_at) as newest_created_at,
  bool_or(review_status = 'reviewed') as has_reviewed_row,
  bool_or(category is not null and category not in ('Miscellaneous', 'Other Income')) as has_non_default_category,
  bool_or(nullif(trim(coalesce(notes, '')), '') is not null) as has_notes,
  bool_or(matched_job_id is not null or matched_income_id is not null or matched_expense_id is not null) as has_match,
  (select id from survivors s where s.canonical_base_hash = duplicate_rows.canonical_base_hash and s.balance is not distinct from duplicate_rows.balance limit 1) as chosen_survivor_id,
  array_agg(id order by survivor_rank, created_at asc nulls last) as row_ids_in_review_order
from duplicate_rows
group by canonical_base_hash, balance
order by rows_in_group desc, oldest_created_at;

-- Summary:
with duplicate_groups as (
  select canonical_base_hash, balance, count(*) as row_count
  from public.smartfobs_bank_transactions
  where canonical_base_hash is not null
  group by canonical_base_hash, balance
  having count(*) > 1
)
select
  count(*) as suspected_duplicate_groups,
  coalesce(sum(row_count - 1), 0) as rows_that_would_be_removed_if_all_groups_are_confirmed_exact_duplicates
from duplicate_groups;

-- Generated cleanup statements for manual review. These are text only.
with ranked as (
  select
    *,
    row_number() over (
      partition by canonical_base_hash, balance
      order by
        case when matched_job_id is not null or matched_income_id is not null or matched_expense_id is not null then 0 else 1 end,
        case when review_status = 'reviewed' then 0 else 1 end,
        case when category is not null and category not in ('Miscellaneous', 'Other Income') then 0 else 1 end,
        case when nullif(trim(coalesce(notes, '')), '') is not null then 0 else 1 end,
        created_at asc nulls last,
        id asc
    ) as survivor_rank,
    first_value(id) over (
      partition by canonical_base_hash, balance
      order by
        case when matched_job_id is not null or matched_income_id is not null or matched_expense_id is not null then 0 else 1 end,
        case when review_status = 'reviewed' then 0 else 1 end,
        case when category is not null and category not in ('Miscellaneous', 'Other Income') then 0 else 1 end,
        case when nullif(trim(coalesce(notes, '')), '') is not null then 0 else 1 end,
        created_at asc nulls last,
        id asc
    ) as survivor_id,
    count(*) over (partition by canonical_base_hash, balance) as group_size
  from public.smartfobs_bank_transactions
  where canonical_base_hash is not null
)
select
  '-- Review duplicate group ' || canonical_base_hash || E'\n' ||
  '-- Survivor: ' || survivor_id || E'\n' ||
  '-- Merge useful data into survivor before deleting this duplicate copy:' || E'\n' ||
  'update public.smartfobs_bank_transactions as survivor' || E'\n' ||
  'set' || E'\n' ||
  '  category = case when survivor.category is null or survivor.category in (''Miscellaneous'', ''Other Income'') then coalesce(removal.category, survivor.category) else survivor.category end,' || E'\n' ||
  '  category_type = coalesce(survivor.category_type, removal.category_type),' || E'\n' ||
  '  review_status = case when survivor.review_status = ''reviewed'' then survivor.review_status else coalesce(removal.review_status, survivor.review_status) end,' || E'\n' ||
  '  notes = case when nullif(trim(coalesce(survivor.notes, '''')), '''') is null then removal.notes else survivor.notes end,' || E'\n' ||
  '  matched_job_id = coalesce(survivor.matched_job_id, removal.matched_job_id),' || E'\n' ||
  '  matched_income_id = coalesce(survivor.matched_income_id, removal.matched_income_id),' || E'\n' ||
  '  matched_expense_id = coalesce(survivor.matched_expense_id, removal.matched_expense_id),' || E'\n' ||
  '  updated_at = now()' || E'\n' ||
  'from public.smartfobs_bank_transactions as removal' || E'\n' ||
  'where survivor.id = ' || quote_literal(survivor_id) || ' and removal.id = ' || quote_literal(id) || ';' || E'\n' ||
  '-- Remove only after confirming rows are duplicate copies, not genuine repeated transactions:' || E'\n' ||
  'delete from public.smartfobs_bank_transactions where id = ''' || id || ''';' as cleanup_sql
from ranked
where group_size > 1
  and survivor_rank > 1
order by canonical_base_hash, survivor_rank;

-- Legacy shifted-date duplicate report. This catches rows from older imports
-- where UK text dates may have been shifted by browser timezone parsing. These
-- groups use normalised description + signed amount + balance, not date.
with legacy_groups as (
  select
    trim(regexp_replace(
      lower(regexp_replace(coalesce(description, ''), '[^[:alnum:]]+', ' ', 'g')),
      '\s+',
      ' ',
      'g'
    )) || '|' ||
    coalesce(round((amount * 100))::bigint::text, '') || '|' ||
    coalesce(round((balance * 100))::bigint::text, '') as legacy_duplicate_key,
    count(*) as row_count,
    min(transaction_date) as earliest_transaction_date,
    max(transaction_date) as latest_transaction_date,
    array_agg(id order by created_at asc nulls last, id asc) as row_ids
  from public.smartfobs_bank_transactions
  where balance is not null
  group by 1
  having count(*) > 1
)
select *
from legacy_groups
order by row_count desc, earliest_transaction_date;

-- Generated legacy shifted-date cleanup statements for manual review. These
-- catch old rows where the same transaction was stored with a shifted date.
with legacy_ranked as (
  select
    *,
    trim(regexp_replace(
      lower(regexp_replace(coalesce(description, ''), '[^[:alnum:]]+', ' ', 'g')),
      '\s+',
      ' ',
      'g'
    )) || '|' ||
    coalesce(round((amount * 100))::bigint::text, '') || '|' ||
    coalesce(round((balance * 100))::bigint::text, '') as legacy_duplicate_key,
    row_number() over (
      partition by
        trim(regexp_replace(
          lower(regexp_replace(coalesce(description, ''), '[^[:alnum:]]+', ' ', 'g')),
          '\s+',
          ' ',
          'g'
        )) || '|' ||
        coalesce(round((amount * 100))::bigint::text, '') || '|' ||
        coalesce(round((balance * 100))::bigint::text, '')
      order by
        case when matched_job_id is not null or matched_income_id is not null or matched_expense_id is not null then 0 else 1 end,
        case when review_status = 'reviewed' then 0 else 1 end,
        case when category is not null and category not in ('Miscellaneous', 'Other Income') then 0 else 1 end,
        case when nullif(trim(coalesce(notes, '')), '') is not null then 0 else 1 end,
        created_at asc nulls last,
        id asc
    ) as survivor_rank,
    first_value(id) over (
      partition by
        trim(regexp_replace(
          lower(regexp_replace(coalesce(description, ''), '[^[:alnum:]]+', ' ', 'g')),
          '\s+',
          ' ',
          'g'
        )) || '|' ||
        coalesce(round((amount * 100))::bigint::text, '') || '|' ||
        coalesce(round((balance * 100))::bigint::text, '')
      order by
        case when matched_job_id is not null or matched_income_id is not null or matched_expense_id is not null then 0 else 1 end,
        case when review_status = 'reviewed' then 0 else 1 end,
        case when category is not null and category not in ('Miscellaneous', 'Other Income') then 0 else 1 end,
        case when nullif(trim(coalesce(notes, '')), '') is not null then 0 else 1 end,
        created_at asc nulls last,
        id asc
    ) as survivor_id,
    count(*) over (
      partition by
        trim(regexp_replace(
          lower(regexp_replace(coalesce(description, ''), '[^[:alnum:]]+', ' ', 'g')),
          '\s+',
          ' ',
          'g'
        )) || '|' ||
        coalesce(round((amount * 100))::bigint::text, '') || '|' ||
        coalesce(round((balance * 100))::bigint::text, '')
    ) as group_size,
    min(transaction_date) over (
      partition by
        trim(regexp_replace(
          lower(regexp_replace(coalesce(description, ''), '[^[:alnum:]]+', ' ', 'g')),
          '\s+',
          ' ',
          'g'
        )) || '|' ||
        coalesce(round((amount * 100))::bigint::text, '') || '|' ||
        coalesce(round((balance * 100))::bigint::text, '')
    ) as earliest_legacy_date,
    max(transaction_date) over (
      partition by
        trim(regexp_replace(
          lower(regexp_replace(coalesce(description, ''), '[^[:alnum:]]+', ' ', 'g')),
          '\s+',
          ' ',
          'g'
        )) || '|' ||
        coalesce(round((amount * 100))::bigint::text, '') || '|' ||
        coalesce(round((balance * 100))::bigint::text, '')
    ) as latest_legacy_date
  from public.smartfobs_bank_transactions
  where balance is not null
)
select
  '-- Review legacy shifted-date duplicate group ' || legacy_duplicate_key || E'\n' ||
  '-- Survivor: ' || survivor_id || E'\n' ||
  'update public.smartfobs_bank_transactions as survivor' || E'\n' ||
  'set' || E'\n' ||
  '  category = case when survivor.category is null or survivor.category in (''Miscellaneous'', ''Other Income'') then coalesce(removal.category, survivor.category) else survivor.category end,' || E'\n' ||
  '  category_type = coalesce(survivor.category_type, removal.category_type),' || E'\n' ||
  '  review_status = case when survivor.review_status = ''reviewed'' then survivor.review_status else coalesce(removal.review_status, survivor.review_status) end,' || E'\n' ||
  '  notes = case when nullif(trim(coalesce(survivor.notes, '''')), '''') is null then removal.notes else survivor.notes end,' || E'\n' ||
  '  matched_job_id = coalesce(survivor.matched_job_id, removal.matched_job_id),' || E'\n' ||
  '  matched_income_id = coalesce(survivor.matched_income_id, removal.matched_income_id),' || E'\n' ||
  '  matched_expense_id = coalesce(survivor.matched_expense_id, removal.matched_expense_id),' || E'\n' ||
  '  updated_at = now()' || E'\n' ||
  'from public.smartfobs_bank_transactions as removal' || E'\n' ||
  'where survivor.id = ' || quote_literal(survivor_id) || ' and removal.id = ' || quote_literal(id) || ';' || E'\n' ||
  'delete from public.smartfobs_bank_transactions where id = ' || quote_literal(id) || ';' as cleanup_sql
from legacy_ranked
where group_size > 1
  and earliest_legacy_date is distinct from latest_legacy_date
  and survivor_rank > 1
order by legacy_duplicate_key, survivor_rank;
