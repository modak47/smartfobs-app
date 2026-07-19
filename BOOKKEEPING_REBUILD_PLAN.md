# SmartFobs / DWB Trading Bookkeeping Rebuild Plan

Inspection date: 19 July 2026  
Workbook source of truth: `data/imports/DWB_Accountant_Bookkeeping_2026-27 live.xlsx`  
Scope of this document: architecture/rebuild planning only. No workbook import, database mutation, UI redesign, deployment, or data deletion has been performed.

## 1. Existing architecture

The project is a small Next.js App Router application using TypeScript, React, Tailwind CSS, and Supabase.

### Runtime and package stack

- Next.js `16.2.9`
- React `19.2.4`
- TypeScript
- Tailwind CSS v4 through `@tailwindcss/postcss`
- Supabase JS client `@supabase/supabase-js`
- `node-forge` for CSR/key-related local tooling
- Test scripts currently use plain Node scripts rather than a full test runner.

### App Router structure

Current routes/pages:

- `/` — main SmartFobs app in `app/page.tsx`.
- `/bank` — server page wrapper in `app/bank/page.tsx` that loads the same main app with initial Bank tab/query filter state.
- `/smartfobs` — older/simple jobs and expenses page in `app/smartfobs/page.tsx`.
- `/privacy` — legal privacy page.
- `/terms` — legal terms page.
- `/api/auth/hsbc/callback` — route handler for a placeholder HSBC/Open Banking callback.

The main app is a large client component. It owns most data fetching, mutation, state, CSV parsing, forms, reports, bank review, and navigation.

### Current feature areas

`app/page.tsx` currently contains:

- Mobile-first shell with bottom navigation.
- Tabs/views: Home, Jobs, Expenses, Reports, Bank.
- Manual job creation, editing, deletion, CSV export.
- Manual expense creation, editing, deletion, CSV export.
- Receipt preview only, not persisted.
- Bank CSV import preview and confirm-import workflow.
- HSBC signed Amount CSV support.
- Bank import duplicate detection using canonical fingerprints and occurrence indexes.
- Bank transaction review/edit modal.
- Categorisation rules with “remember this” support.
- Report totals through `lib/bookkeeping/reporting.ts`.
- Tax-year estimate section.
- Stock value section using `smartfobs_settings`.
- Placeholder panels for Shopify Import and Bank Connection.

`app/smartfobs/page.tsx` is an older standalone CRUD page for jobs/expenses. It duplicates a subset of the main app and does not include the newer reporting/import logic.

### Library structure

- `lib/supabase.tsx`
  - Creates a browser Supabase client using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

- `lib/bookkeeping/index.ts`
  - Shared date, money, tax-year, category type, and bank fingerprint helpers.

- `lib/bookkeeping/reporting.ts`
  - New shared reporting reconciliation function.
  - Treats jobs and expenses as authoritative records.
  - Includes only eligible standalone bank rows.
  - Excludes matched, unreviewed, non-business, and likely duplicate bank rows.

### Scripts

- `scripts/bookkeeping-duplicate-tests.mjs`
  - Tests canonical bank duplicate/import logic.

- `scripts/reporting-tests.mjs`
  - Tests reporting reconciliation rules.

- `scripts/run-reporting-tests.mjs`
  - Temporary runner that executes TypeScript reporting logic from Node.

- `make-csr.js`, `private.key`, `eidas.csr`
  - Open Banking/eIDAS sandbox related artefacts. These are not part of active bookkeeping workflow.

### Supabase usage

The application currently talks directly to Supabase from client components using the public anon key.

Read/write operations are performed client-side for:

- Jobs
- Expenses
- Bank transactions
- Settings
- Bank import batches
- Categorisation rules

There is no obvious user authentication/session layer in the application yet. The only “auth” route is the HSBC callback placeholder, which validates the presence of `code` and `state` enough to redirect back to `/bank` with a status, but it does not perform token exchange or store consent.

### Environment variables

Current `.env.local` variable names:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

No service-role key is used in the app. No server-only Supabase admin client exists.

## 2. What works well

The current app has a useful foundation:

- It is already connected to Supabase.
- It has a mobile-first interface that suits day-to-day use.
- Manual job and expense capture works.
- Bank CSV upload and preview exist.
- Signed HSBC Amount CSV handling is implemented.
- Bank duplicate detection has moved in the right direction with canonical fingerprints.
- Bank transactions can be reviewed/reclassified.
- Categorisation rules can be remembered from review.
- Reports now use a shared reconciliation function instead of scattered double-counting logic.
- The app has basic tax-year awareness.
- Stock value settings are persisted in Supabase.
- There are useful tests for duplicate import and reporting logic.
- Legal/privacy pages exist, which matters if banking/customer data is handled.

The best parts to preserve are:

- Next.js App Router foundation.
- Supabase as backend.
- Mobile-first data entry.
- The reporting reconciliation idea.
- The bank CSV preview-before-import workflow.
- Categorisation rules.
- The SmartFobs dark/silver visual identity.

## 3. What is obsolete or should be replaced

### Main app monolith

`app/page.tsx` is doing too much. It mixes:

- UI
- data loading
- validation
- CSV parsing
- bank import logic
- reporting
- reconciliation
- tax estimates
- stock settings
- modal state
- navigation

This should be split into modules/components/features.

### Direct client-side database mutations

Most mutations are done directly from client components with the anon key. For a personal internal app this can work temporarily, but a proper business management system should move important mutations to:

- server actions, or
- route handlers, or
- typed service modules with RLS policies.

This is especially important for imports, accounting records, matching, and future banking connections.

### Duplicate `/smartfobs` route

`app/smartfobs/page.tsx` is an older app version. It duplicates job/expense functionality and has obsolete totals. It should either be removed later or turned into a redirect once the main app is stabilised.

### Workbook and app model are not aligned

The reviewed workbook is currently more accountant-ready than the app. It has fields that the app does not model properly yet:

- Business Status
- Business Use %
- Allowable?
- Allowable Income
- Allowable Expense
- VAT Treatment
- Receipt Status
- Receipt/File Link
- Bike/Job Ref
- MTD Quarter
- Accountant Review
- Bank Balance
- Mileage
- Bike stock lifecycle

The app must adopt this structure rather than trying to squeeze everything into the older jobs/expenses/bank split.

### Stock accounting is still too rough

The app stores stock value settings, but the workbook treats stock purchases explicitly using `Allowable? = Stock` and a separate Bike Stock sheet. A modernised app needs a real stock ledger rather than just manual stock-value totals.

### Import/matching still needs a formal workflow

The app flags likely duplicates, but it does not provide a complete confirm-match workflow linking:

- bank transaction to job
- bank transaction to expense
- bank transaction to stock item
- bank transaction to owner drawing/transfer

### Authentication and access control are missing

There is no app-level login/user/session model visible. Before becoming a proper business management system, the app needs authentication, authorization, and RLS policies.

### README and metadata are still mostly create-next-app defaults

The README and root metadata should eventually describe SmartFobs/DWB Trading, not the default Next.js starter.

### Open Banking files should be isolated

`private.key`, `eidas.csr`, and `make-csr.js` exist in the project. They should not be part of ordinary app logic. Keys/CSRs should be handled as secrets or generated artefacts, not core application files.

## 4. Existing Supabase tables identified

From code, migrations, and read-only Supabase checks, these SmartFobs tables are currently reachable:

| Table | Current count | Purpose | Notable columns observed |
|---|---:|---|---|
| `smartfobs_jobs` | 52 | Manual/job income records | `job_date`, `customer_name`, `dealer_name`, `contact`, `vehicle`, `registration`, `job_type`, `source`, `payment_method`, `payment_status`, `amount_charged`, `notes`, `shopify_order_id` |
| `smartfobs_expenses` | 85 | Manual expense records | `expense_date`, `supplier`, `category`, `description`, `amount`, `payment_method`, `notes`, `receipt_url` |
| `smartfobs_bank_transactions` | 333 | Imported/reviewed bank rows | `transaction_date`, `type`, `description`, `amount`, `balance`, `action`, `category`, `transaction_type`, `money_in`, `money_out`, `bank_reference`, `source_filename`, `import_batch_id`, `transaction_hash`, `category_type`, `review_status`, `notes`, `matched_job_id`, `matched_income_id`, `matched_expense_id`, `canonical_base_hash`, `occurrence_index` |
| `smartfobs_settings` | 1 | App settings JSON | `key`, `value`, `updated_at` |
| `smartfobs_bank_import_batches` | 1 | Import batch audit records | `filename`, `imported_at`, `total_rows`, `imported_rows`, `duplicate_rows`, `rejected_rows`, `date_from`, `date_to`, `status` |
| `smartfobs_bookkeeping_categories` | 31 | Category list | `name`, `type`, `active`, `sort_order` |
| `smartfobs_categorisation_rules` | 38 | Bank categorisation rules | `rule_name`, `match_text`, `match_type`, `money_direction`, `assigned_category`, `assigned_category_type`, `active`, `priority` |

The app also expects `smartfobs_bank_transactions` to have older columns such as `transaction_key`, `type`, `description`, `amount`, `balance`, `action`, and `category`, which likely pre-date the visible migrations.

## 5. Workbook inspection summary

Workbook path:

`data/imports/DWB_Accountant_Bookkeeping_2026-27 live.xlsx`

Sheets:

- `Transactions`
- `Dashboard`
- `MTD Summary`
- `Bike Stock`
- `Mileage`
- `Lists`
- `Instructions`
- `Tax Estimate`

### Workbook transaction model

`Transactions` has 227 data rows and 21 columns:

1. Date
2. Bank Type
3. Description
4. Original Amount (£)
5. Direction
6. Payment Method
7. Category
8. Subcategory / Detail
9. Business Status
10. Business Use %
11. Allowable?
12. Allowable Income (£)
13. Allowable Expense (£)
14. VAT Treatment
15. Receipt Status
16. Receipt / File Link
17. Bike / Job Ref
18. MTD Quarter
19. Notes
20. Accountant Review
21. Bank Balance (£)

Workbook computed totals seen during inspection:

- All workbook transaction rows: 227
- Total allowable income across workbook data: £40,173.58
- Total allowable expenses across workbook data: £19,027.15
- Business rows: 216
- Personal rows: 3
- `Allowable? = Stock` rows: 9
- Needs category review rows: 0

For the current tax year window shown in the workbook dashboard, 6 April 2026 to 5 April 2027:

- Business income: £21,997.92
- Allowable expenses: £11,010.57
- Profit recorded so far: £10,987.35
- Latest transaction date: 17 July 2026
- Latest bank balance: £10,518.93
- Missing receipt count: 71
- Personal/excluded count: 6
- Tax-year transaction count: 116

Important: these workbook numbers differ from the current app’s reported tax-year numbers. The workbook should be treated as the reviewed source of truth for the rebuild, but should not be imported until a dry-run mapping and reconciliation screen exists.

## 6. Proposed modern architecture

The new system should become a Business Management System with a bookkeeping ledger at its centre.

### Architectural principles

1. Keep jobs and expenses easy to enter.
2. Treat bank imports as source evidence, not automatically as accounting records.
3. Treat the reviewed workbook as the canonical accounting classification model.
4. Use one reporting engine everywhere.
5. Keep all imports reversible/auditable.
6. Never delete reviewed data silently.
7. Separate business operations from accounting treatment.
8. Make matching explicit and confirmable.

### Suggested app structure

```text
app/
  page.tsx
  bank/
  jobs/
  expenses/
  stock/
  reports/
  settings/
  api/
    imports/
    bank/
    hsbc/
components/
  layout/
  jobs/
  expenses/
  bank/
  reports/
  stock/
lib/
  supabase/
    client.ts
    server.ts
  bookkeeping/
    reporting.ts
    matching.ts
    categories.ts
    tax.ts
    periods.ts
  imports/
    hsbcCsv.ts
    workbook.ts
    validators.ts
  stock/
    valuation.ts
```

### Suggested data model

Keep existing tables initially, but evolve toward:

#### Core accounting

- `business_transactions`
  - Canonical accounting ledger row.
  - One row per reviewed business transaction.
  - Fields based on workbook `Transactions`.

- `transaction_sources`
  - Links ledger rows back to source records:
    - bank transaction
    - job
    - expense
    - workbook import row
    - Shopify order

- `bank_transactions`
  - Raw bank feed/import evidence.
  - Should not itself define profit unless promoted/matched into ledger.

- `jobs`
  - Operational job/customer work.
  - Can generate/relate to income ledger rows.

- `expenses`
  - Operational expense capture.
  - Can generate/relate to expense ledger rows.

#### Stock

- `stock_items`
  - Bikes, keys, remotes, major stock lines.

- `stock_movements`
  - Purchase, prep cost, adjustment, sale, write-off.

- `bike_stock`
  - Could be either a view over `stock_items` or a dedicated table for motorcycle stock lifecycle.

#### Review and audit

- `import_batches`
  - Workbook imports, bank CSV imports, Shopify imports.

- `review_tasks`
  - Missing receipt, accountant query, category review, duplicate match suggestion.

- `attachments`
  - Receipt/file links.

- `category_rules`
  - Improved version of current categorisation rules.

### Reporting model

Reports should read from the canonical reporting/ledger layer, not independently add:

- jobs + bank income
- expenses + bank outgoings

The current `buildReportingReconciliation` is the right direction but should become a server-side/service-level reporting module that can report from ledger rows and source rows with audit trails.

## 7. Workbook-to-Supabase mapping

The workbook should be imported in a staged/dry-run process, not directly into existing jobs/expenses/bank tables.

### `Transactions` sheet mapping

| Workbook column | Proposed Supabase target |
|---|---|
| Date | `business_transactions.transaction_date` |
| Bank Type | `business_transactions.bank_type` or linked `bank_transactions.transaction_type` |
| Description | `business_transactions.description` |
| Original Amount (£) | `business_transactions.original_amount` signed numeric |
| Direction | derived from amount, stored as `direction` |
| Payment Method | `business_transactions.payment_method` |
| Category | `business_transactions.category_id` or `category_name` |
| Subcategory / Detail | `business_transactions.subcategory` |
| Business Status | `business_transactions.business_status` |
| Business Use % | `business_transactions.business_use_percentage` |
| Allowable? | `business_transactions.allowable_status` |
| Allowable Income (£) | computed/stored audit value `allowable_income` |
| Allowable Expense (£) | computed/stored audit value `allowable_expense` |
| VAT Treatment | `business_transactions.vat_treatment` |
| Receipt Status | `business_transactions.receipt_status` |
| Receipt / File Link | `attachments` or `business_transactions.receipt_url` |
| Bike / Job Ref | link to `stock_items`, `jobs`, or free-text pending match |
| MTD Quarter | derived period field or reporting view |
| Notes | `business_transactions.notes` |
| Accountant Review | `business_transactions.accountant_review_status` |
| Bank Balance (£) | linked bank-row balance/evidence value |

### `Bike Stock` sheet mapping

| Workbook column | Proposed target |
|---|---|
| Bike ID / Reg | `stock_items.stock_ref` / `registration` |
| Purchase Date | `stock_items.purchase_date` |
| Make / Model | `stock_items.name` |
| Purchase Price (£) | `stock_movements.purchase_price` |
| Purchase Costs (£) | `stock_movements.purchase_costs` |
| Parts / Prep (£) | `stock_movements.prep_costs` |
| Status | `stock_items.status` |
| Sale Date | `stock_items.sale_date` |
| Sale Price (£) | `stock_movements.sale_price` or sales ledger link |
| Gross Profit (£) | computed view |
| Customer / Source | `stock_items.customer_or_source` |
| Notes | `stock_items.notes` |

### `Mileage` sheet mapping

| Workbook column | Proposed target |
|---|---|
| Date | `mileage_entries.date` |
| Journey / Purpose | `mileage_entries.purpose` |
| From | `mileage_entries.from_location` |
| To | `mileage_entries.to_location` |
| Vehicle | `mileage_entries.vehicle` |
| Business Miles | `mileage_entries.business_miles` |
| Rate (£/mile) | computed from settings/rules |
| Allowable Mileage (£) | computed value |
| Notes | `mileage_entries.notes` |

### `Lists` sheet mapping

The `Lists` sheet should seed controlled values:

- categories
- payment methods
- business status values
- allowable statuses
- receipt statuses
- review statuses
- income/expense/transfer values
- VAT treatment
- tax assumptions

These should become editable settings/reference tables in Supabase.

### Dashboard, MTD Summary, Tax Estimate

These should not be imported as data tables. They should be rebuilt as app reports/views using the canonical transaction data and tax settings.

## 8. HSBC CSV importing design

HSBC CSV importing should remain a preview-first workflow.

### Import stages

1. Upload CSV.
2. Detect columns:
   - Date
   - Type
   - Description
   - signed Amount
   - Balance
   - optional Reference
3. Parse money using integer pence.
4. Parse dates as UK dates.
5. Preserve signed amount:
   - positive = money in
   - negative = money out
6. Generate canonical fingerprint:
   - date
   - normalised description
   - signed pence amount
   - direction
7. Assign occurrence index for genuine repeated same-day transactions.
8. Compare against existing bank rows.
9. Show preview:
   - total rows
   - valid rows
   - already imported rows
   - genuinely new rows
   - repeated identical occurrences
   - rejected rows
   - money in/out/net movement
10. Import only genuinely new raw bank rows.
11. Create review tasks/match suggestions, but do not create jobs/expenses automatically.

### Bank rows should not automatically hit reports

Raw bank transactions should be evidence. They should affect reports only when:

- reviewed,
- business category is valid,
- not matched to an authoritative record,
- not duplicate of a job/expense/stock transaction,
- not personal/drawings/tax/transfer/ignored.

Long-term, bank rows should be matched/promoted into ledger rows rather than being directly mixed with jobs and expenses.

### Future Open Banking

The existing HSBC callback route is a placeholder. Before real Open Banking:

- store consent state server-side,
- validate callback state,
- exchange code server-side only,
- store tokens securely,
- implement token refresh,
- keep raw bank transaction imports idempotent,
- keep CSV import as fallback.

## 9. Phased rebuild plan

### Phase 0 — Freeze and audit

- Do not import the workbook yet.
- Keep current data unchanged.
- Export/backup current Supabase tables.
- Confirm whether current app data should be superseded by workbook-reviewed data.
- Decide whether stock purchases should reduce profit immediately or be treated as stock assets until sale.

Deliverable:

- Snapshot/backup plan.
- Reconciliation report comparing current app vs workbook.

### Phase 1 — Restructure code without changing behaviour

- Split `app/page.tsx` into feature components.
- Move CSV parsing to `lib/imports/hsbcCsv.ts`.
- Move bank matching to `lib/bookkeeping/matching.ts`.
- Keep the UI visually the same.
- Keep tests passing.
- Keep existing Supabase tables.

Deliverable:

- Cleaner codebase with no data model changes.

### Phase 2 — Add canonical ledger schema beside existing tables

- Add new tables:
  - `business_transactions`
  - `transaction_sources`
  - `stock_items`
  - `stock_movements`
  - `mileage_entries`
  - `attachments`
  - `review_tasks`
  - improved reference/category tables
- Do not delete old tables.
- Add read-only views that compare old model vs new model.

Deliverable:

- Modern schema ready for dry-run imports.

### Phase 3 — Workbook dry-run importer

- Build workbook parser for `DWB_Accountant_Bookkeeping_2026-27 live.xlsx`.
- Import into staging tables only.
- Show mapping preview:
  - row count
  - category mapping
  - allowable income/expenses
  - stock rows
  - personal/excluded rows
  - receipt status
  - accountant review status
  - unmatched references
- Compare computed app totals to workbook dashboard totals.

Deliverable:

- Dry-run workbook import report with zero production mutation.

### Phase 4 — Confirmed workbook import

- After review, import workbook into canonical ledger tables.
- Preserve original workbook row number and source workbook filename.
- Keep existing SmartFobs app records untouched.
- Link existing jobs/expenses/bank rows where high-confidence matches exist.
- Leave ambiguous matches as review tasks.

Deliverable:

- Workbook-backed canonical ledger.

### Phase 5 — Matching and review workflow

- Add UI to confirm:
  - bank transaction ↔ job
  - bank transaction ↔ expense
  - bank transaction ↔ stock item
  - bank transaction ↔ owner drawing/transfer/personal
- Add “possible duplicate” queue.
- Add “missing receipt” queue.
- Add “accountant query” queue.
- Add one-click rule creation from confirmed classifications.

Deliverable:

- Practical daily review workflow.

### Phase 6 — Stock and business management

- Build stock dashboard:
  - bikes in stock
  - purchase cost
  - prep cost
  - expected sale price
  - sold bikes
  - gross profit
- Build key/remote stock tracking.
- Separate cash spent from profit treatment where appropriate.
- Link stock purchases/sales to bank rows and ledger rows.

Deliverable:

- Real business management beyond bookkeeping.

### Phase 7 — Reports and accountant pack

- Rebuild reports from canonical ledger:
  - dashboard
  - selected month
  - tax year
  - MTD quarterly
  - category breakdown
  - receipt/missing evidence
  - stock report
  - mileage report
  - tax estimate
- Add export pack:
  - CSV
  - accountant workbook
  - summary PDF later if needed.

Deliverable:

- Accountant-ready reporting pack.

### Phase 8 — Shopify import

- Start with Shopify orders CSV.
- Create jobs/sales from Shopify orders.
- Treat Shopify bank payouts as transfers/settlements to avoid double counting.
- Later add Shopify API after CSV workflow is proven.

Deliverable:

- Shopify sales integrated without payout double counting.

### Phase 9 — Open Banking

- Keep HSBC CSV as fallback.
- Add real Open Banking only after:
  - auth/session model exists,
  - server-side secrets exist,
  - matching/review workflow is stable,
  - bank import idempotency is proven.

Deliverable:

- Safe automated bank feed.

### Phase 10 — Authentication and production hardening

- Add authentication.
- Add Supabase RLS policies.
- Move sensitive mutations server-side.
- Add backups/export tools.
- Add audit logs.
- Update README and app metadata.
- Remove or archive obsolete `/smartfobs` route.

Deliverable:

- Private, maintainable, production-ready Business Management System.

## 10. Recommended immediate next step

Do not import the workbook yet.

The next build step should be:

1. Add a read-only workbook dry-run parser.
2. Produce a reconciliation screen/report comparing:
   - workbook dashboard totals
   - current app report totals
   - current Supabase jobs/expenses/bank rows
3. Decide which data wins when the same real-world transaction exists in both app and workbook.

That gives a safe bridge from the current MVP to the accountant-reviewed model without losing the work already done in the app.
