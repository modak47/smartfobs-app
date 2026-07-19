create extension if not exists pgcrypto;

create or replace function public.bookkeeping_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.bookkeeping_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  transaction_date date not null,
  bank_type text,
  description text not null,
  original_amount numeric(12,2) not null,
  direction text not null,
  payment_method text,
  category text,
  subcategory text,
  business_status text,
  business_use_percent numeric(5,2) default 100,
  allowable_status text,
  allowable_income numeric(12,2) default 0,
  allowable_expense numeric(12,2) default 0,
  vat_treatment text,
  receipt_status text,
  receipt_file_url text,
  receipt_id uuid,
  bike_job_reference text,
  mtd_quarter text,
  notes text,
  accountant_review text,
  bank_balance numeric(12,2),
  source_type text,
  source_filename text,
  source_row_number integer,
  transaction_hash text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.bookkeeping_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  import_type text,
  filename text,
  file_hash text,
  total_rows integer,
  imported_rows integer,
  duplicate_rows integer,
  failed_rows integer,
  error_details jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.bookkeeping_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  transaction_id uuid references public.bookkeeping_transactions(id) on delete set null,
  receipt_date date,
  merchant text,
  total_amount numeric(12,2),
  category text,
  notes text,
  storage_path text,
  file_url text,
  status text,
  match_confidence numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.bookkeeping_transactions
  drop constraint if exists bookkeeping_transactions_receipt_id_fkey;

alter table public.bookkeeping_transactions
  add constraint bookkeeping_transactions_receipt_id_fkey
  foreign key (receipt_id) references public.bookkeeping_receipts(id) on delete set null;

create table if not exists public.bookkeeping_category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  match_text text,
  match_type text,
  category text,
  subcategory text,
  business_status text,
  business_use_percent numeric(5,2),
  allowable_status text,
  priority integer default 100,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.bookkeeping_mileage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  journey_date date,
  start_location text,
  end_location text,
  purpose text,
  miles numeric(10,2),
  rate_per_mile numeric(10,4),
  claim_amount numeric(12,2),
  vehicle text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.bookkeeping_bike_stock (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  purchase_date date,
  registration text,
  make text,
  model text,
  year integer,
  purchase_price numeric(12,2),
  sale_date date,
  sale_price numeric(12,2),
  buyer_or_seller text,
  status text,
  transaction_id uuid references public.bookkeeping_transactions(id) on delete set null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists bookkeeping_transactions_transaction_date_idx on public.bookkeeping_transactions(transaction_date);
create index if not exists bookkeeping_transactions_transaction_hash_idx on public.bookkeeping_transactions(transaction_hash);
create index if not exists bookkeeping_transactions_category_idx on public.bookkeeping_transactions(category);
create index if not exists bookkeeping_transactions_direction_idx on public.bookkeeping_transactions(direction);
create index if not exists bookkeeping_transactions_receipt_status_idx on public.bookkeeping_transactions(receipt_status);
create index if not exists bookkeeping_transactions_receipt_id_idx on public.bookkeeping_transactions(receipt_id);
create index if not exists bookkeeping_transactions_created_at_idx on public.bookkeeping_transactions(created_at);
create index if not exists bookkeeping_imports_created_at_idx on public.bookkeeping_imports(created_at);
create index if not exists bookkeeping_receipts_transaction_id_idx on public.bookkeeping_receipts(transaction_id);
create index if not exists bookkeeping_receipts_status_idx on public.bookkeeping_receipts(status);
create index if not exists bookkeeping_receipts_created_at_idx on public.bookkeeping_receipts(created_at);
create index if not exists bookkeeping_rules_active_priority_idx on public.bookkeeping_category_rules(is_active, priority);
create index if not exists bookkeeping_mileage_journey_date_idx on public.bookkeeping_mileage(journey_date);
create index if not exists bookkeeping_bike_stock_status_idx on public.bookkeeping_bike_stock(status);
create index if not exists bookkeeping_bike_stock_transaction_id_idx on public.bookkeeping_bike_stock(transaction_id);

drop trigger if exists bookkeeping_transactions_updated_at on public.bookkeeping_transactions;
create trigger bookkeeping_transactions_updated_at before update on public.bookkeeping_transactions for each row execute function public.bookkeeping_set_updated_at();
drop trigger if exists bookkeeping_receipts_updated_at on public.bookkeeping_receipts;
create trigger bookkeeping_receipts_updated_at before update on public.bookkeeping_receipts for each row execute function public.bookkeeping_set_updated_at();
drop trigger if exists bookkeeping_category_rules_updated_at on public.bookkeeping_category_rules;
create trigger bookkeeping_category_rules_updated_at before update on public.bookkeeping_category_rules for each row execute function public.bookkeeping_set_updated_at();
drop trigger if exists bookkeeping_mileage_updated_at on public.bookkeeping_mileage;
create trigger bookkeeping_mileage_updated_at before update on public.bookkeeping_mileage for each row execute function public.bookkeeping_set_updated_at();
drop trigger if exists bookkeeping_bike_stock_updated_at on public.bookkeeping_bike_stock;
create trigger bookkeeping_bike_stock_updated_at before update on public.bookkeeping_bike_stock for each row execute function public.bookkeeping_set_updated_at();

insert into storage.buckets (id, name, public)
values ('bookkeeping-receipts', 'bookkeeping-receipts', false)
on conflict (id) do update set public = false;

alter table public.bookkeeping_transactions enable row level security;
alter table public.bookkeeping_imports enable row level security;
alter table public.bookkeeping_receipts enable row level security;
alter table public.bookkeeping_category_rules enable row level security;
alter table public.bookkeeping_mileage enable row level security;
alter table public.bookkeeping_bike_stock enable row level security;

drop policy if exists "single user read bookkeeping transactions" on public.bookkeeping_transactions;
create policy "single user read bookkeeping transactions" on public.bookkeeping_transactions for select using (true);
drop policy if exists "single user write bookkeeping transactions" on public.bookkeeping_transactions;
create policy "single user write bookkeeping transactions" on public.bookkeeping_transactions for all using (true) with check (true);

drop policy if exists "single user read bookkeeping imports" on public.bookkeeping_imports;
create policy "single user read bookkeeping imports" on public.bookkeeping_imports for select using (true);
drop policy if exists "single user write bookkeeping imports" on public.bookkeeping_imports;
create policy "single user write bookkeeping imports" on public.bookkeeping_imports for all using (true) with check (true);

drop policy if exists "single user read bookkeeping receipts" on public.bookkeeping_receipts;
create policy "single user read bookkeeping receipts" on public.bookkeeping_receipts for select using (true);
drop policy if exists "single user write bookkeeping receipts" on public.bookkeeping_receipts;
create policy "single user write bookkeeping receipts" on public.bookkeeping_receipts for all using (true) with check (true);

drop policy if exists "single user read bookkeeping rules" on public.bookkeeping_category_rules;
create policy "single user read bookkeeping rules" on public.bookkeeping_category_rules for select using (true);
drop policy if exists "single user write bookkeeping rules" on public.bookkeeping_category_rules;
create policy "single user write bookkeeping rules" on public.bookkeeping_category_rules for all using (true) with check (true);

drop policy if exists "single user read bookkeeping mileage" on public.bookkeeping_mileage;
create policy "single user read bookkeeping mileage" on public.bookkeeping_mileage for select using (true);
drop policy if exists "single user write bookkeeping mileage" on public.bookkeeping_mileage;
create policy "single user write bookkeeping mileage" on public.bookkeeping_mileage for all using (true) with check (true);

drop policy if exists "single user read bookkeeping bike stock" on public.bookkeeping_bike_stock;
create policy "single user read bookkeeping bike stock" on public.bookkeeping_bike_stock for select using (true);
drop policy if exists "single user write bookkeeping bike stock" on public.bookkeeping_bike_stock;
create policy "single user write bookkeeping bike stock" on public.bookkeeping_bike_stock for all using (true) with check (true);

drop policy if exists "single user read receipt files" on storage.objects;
create policy "single user read receipt files" on storage.objects for select using (bucket_id = 'bookkeeping-receipts');
drop policy if exists "single user write receipt files" on storage.objects;
create policy "single user write receipt files" on storage.objects for all using (bucket_id = 'bookkeeping-receipts') with check (bucket_id = 'bookkeeping-receipts');

insert into public.bookkeeping_category_rules
  (match_text, match_type, category, subcategory, business_status, business_use_percent, allowable_status, priority, is_active)
values
  ('OPENAI', 'contains', 'Software and Subscriptions', null, 'Business', 100, 'Yes', 10, true),
  ('CHATGPT', 'contains', 'Software and Subscriptions', null, 'Business', 100, 'Yes', 11, true),
  ('SHOPIFY', 'contains', 'Software and Subscriptions', null, 'Business', 100, 'Yes', 20, true),
  ('ROYAL MAIL', 'contains', 'Postage and Courier', null, 'Business', 100, 'Yes', 30, true),
  ('POST OFFICE', 'contains', 'Postage and Courier', null, 'Business', 100, 'Yes', 31, true),
  ('AUTOTRADER', 'contains', 'Advertising and Marketing', null, 'Business', 100, 'Yes', 40, true),
  ('SHELL', 'contains', 'Fuel / Vehicle Costs', null, 'Business', 100, 'Yes', 50, true),
  ('BP ', 'contains', 'Fuel / Vehicle Costs', null, 'Business', 100, 'Yes', 51, true),
  ('ESSO', 'contains', 'Fuel / Vehicle Costs', null, 'Business', 100, 'Yes', 52, true),
  ('TEXACO', 'contains', 'Fuel / Vehicle Costs', null, 'Business', 100, 'Yes', 53, true),
  ('EBAY', 'contains', 'Needs Review', null, 'Review', 100, 'Review', 80, true),
  ('ALIEXPRESS', 'contains', 'Needs Review', null, 'Review', 100, 'Review', 81, true)
on conflict do nothing;
