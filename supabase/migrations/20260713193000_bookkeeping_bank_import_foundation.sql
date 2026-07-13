create extension if not exists pgcrypto;

create table if not exists public.smartfobs_bank_import_batches (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  imported_at timestamp with time zone not null default now(),
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  rejected_rows integer not null default 0,
  date_from date,
  date_to date,
  status text not null default 'completed'
);

alter table if exists public.smartfobs_bank_transactions
  add column if not exists transaction_type text,
  add column if not exists money_in numeric(12,2),
  add column if not exists money_out numeric(12,2),
  add column if not exists bank_reference text,
  add column if not exists source_filename text,
  add column if not exists import_batch_id uuid references public.smartfobs_bank_import_batches(id),
  add column if not exists transaction_hash text,
  add column if not exists category_type text not null default 'expense',
  add column if not exists review_status text not null default 'needs_review',
  add column if not exists notes text,
  add column if not exists matched_job_id uuid,
  add column if not exists matched_income_id uuid,
  add column if not exists matched_expense_id uuid,
  add column if not exists updated_at timestamp with time zone not null default now();

update public.smartfobs_bank_transactions
set
  transaction_type = coalesce(transaction_type, type),
  money_in = case when amount > 0 then amount else money_in end,
  money_out = case when amount < 0 then abs(amount) else money_out end,
  category_type = case
    when action = 'income' then 'income'
    when action = 'expense' then 'expense'
    when action = 'drawings' then 'owner'
    when action = 'ignore' then 'ignored'
    else category_type
  end,
  review_status = case
    when category in ('Miscellaneous', 'Other Income') then 'needs_review'
    else coalesce(review_status, 'needs_review')
  end,
  transaction_hash = coalesce(
    transaction_hash,
    'sf_' || encode(digest(
      coalesce(transaction_date::text, '') || '|' ||
      upper(regexp_replace(coalesce(description, ''), '\s+', ' ', 'g')) || '|' ||
      coalesce(round((amount * 100))::text, '') || '|' ||
      upper(regexp_replace(coalesce(bank_reference, ''), '\s+', ' ', 'g')),
      'sha256'
    ), 'hex')
  )
where transaction_hash is null
   or transaction_type is null
   or money_in is null
   or money_out is null;

create unique index if not exists smartfobs_bank_transactions_transaction_hash_uidx
  on public.smartfobs_bank_transactions(transaction_hash)
  where transaction_hash is not null;

create index if not exists smartfobs_bank_transactions_date_idx on public.smartfobs_bank_transactions(transaction_date);
create index if not exists smartfobs_bank_transactions_review_status_idx on public.smartfobs_bank_transactions(review_status);
create index if not exists smartfobs_bank_transactions_category_idx on public.smartfobs_bank_transactions(category);
create index if not exists smartfobs_bank_transactions_import_batch_idx on public.smartfobs_bank_transactions(import_batch_id);
create index if not exists smartfobs_bank_transactions_matched_job_idx on public.smartfobs_bank_transactions(matched_job_id);
create index if not exists smartfobs_bank_transactions_matched_income_idx on public.smartfobs_bank_transactions(matched_income_id);
create index if not exists smartfobs_bank_transactions_matched_expense_idx on public.smartfobs_bank_transactions(matched_expense_id);

create table if not exists public.smartfobs_bookkeeping_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('income', 'expense', 'transfer', 'owner', 'tax', 'ignored')),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  unique(name, type)
);

insert into public.smartfobs_bookkeeping_categories (name, type, sort_order)
values
  ('Smart key services', 'income', 10),
  ('Locksmith services', 'income', 20),
  ('Product sales', 'income', 30),
  ('Call-out charges', 'income', 40),
  ('Other business income', 'income', 90),
  ('Refund received', 'income', 100),
  ('Keys and remotes', 'expense', 10),
  ('Parts and materials', 'expense', 20),
  ('Tools and equipment', 'expense', 30),
  ('Vehicle and travel', 'expense', 40),
  ('Fuel', 'expense', 50),
  ('Insurance', 'expense', 60),
  ('Advertising and marketing', 'expense', 70),
  ('Website and software', 'expense', 80),
  ('Telephone and internet', 'expense', 90),
  ('Bank charges', 'expense', 100),
  ('Postage and delivery', 'expense', 110),
  ('Professional fees', 'expense', 120),
  ('Training', 'expense', 130),
  ('Repairs and maintenance', 'expense', 140),
  ('Office costs', 'expense', 150),
  ('Other business expense', 'expense', 900),
  ('Customer refund', 'expense', 910),
  ('Transfer between accounts', 'transfer', 10),
  ('Owner contribution', 'owner', 20),
  ('Owner withdrawal', 'owner', 30),
  ('Tax payment', 'tax', 40),
  ('Loan received', 'owner', 50),
  ('Loan repayment', 'owner', 60),
  ('Personal transaction', 'ignored', 70),
  ('Ignore', 'ignored', 80)
on conflict (name, type) do nothing;

create table if not exists public.smartfobs_categorisation_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  match_text text not null,
  match_type text not null check (match_type in ('contains', 'starts_with', 'exact')),
  money_direction text not null default 'either' check (money_direction in ('incoming', 'outgoing', 'either')),
  assigned_category text not null,
  assigned_category_type text not null check (assigned_category_type in ('income', 'expense', 'transfer', 'owner', 'tax', 'ignored')),
  active boolean not null default true,
  priority integer not null default 100,
  created_at timestamp with time zone not null default now()
);

create index if not exists smartfobs_categories_type_active_idx
  on public.smartfobs_bookkeeping_categories(type, active, sort_order);
create index if not exists smartfobs_rules_active_priority_idx
  on public.smartfobs_categorisation_rules(active, priority);
