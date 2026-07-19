export type Direction = "Income" | "Expense" | "Transfer";

export type BookkeepingTransaction = {
  id: string;
  transaction_date: string;
  bank_type: string | null;
  description: string;
  original_amount: number;
  direction: string;
  payment_method: string | null;
  category: string | null;
  subcategory: string | null;
  business_status: string | null;
  business_use_percent: number | null;
  allowable_status: string | null;
  allowable_income: number | null;
  allowable_expense: number | null;
  vat_treatment: string | null;
  receipt_status: string | null;
  receipt_file_url: string | null;
  receipt_id: string | null;
  bike_job_reference: string | null;
  mtd_quarter: string | null;
  notes: string | null;
  accountant_review: string | null;
  bank_balance: number | null;
  source_type: string | null;
  source_filename: string | null;
  source_row_number: number | null;
  transaction_hash: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type BookkeepingReceipt = {
  id: string;
  transaction_id: string | null;
  receipt_date: string | null;
  merchant: string | null;
  total_amount: number | null;
  category: string | null;
  notes: string | null;
  storage_path: string | null;
  file_url: string | null;
  status: string | null;
  match_confidence: number | null;
  created_at?: string | null;
  signed_url?: string | null;
};

export type BookkeepingMileage = {
  id: string;
  journey_date: string | null;
  start_location: string | null;
  end_location: string | null;
  purpose: string | null;
  miles: number | null;
  rate_per_mile: number | null;
  claim_amount: number | null;
  vehicle: string | null;
  notes: string | null;
};

export type BookkeepingBikeStock = {
  id: string;
  purchase_date: string | null;
  registration: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  purchase_price: number | null;
  sale_date: string | null;
  sale_price: number | null;
  buyer_or_seller: string | null;
  status: string | null;
  transaction_id: string | null;
  notes: string | null;
};

export type CategoryRule = {
  id: string;
  match_text: string | null;
  match_type: string | null;
  category: string | null;
  subcategory: string | null;
  business_status: string | null;
  business_use_percent: number | null;
  allowable_status: string | null;
  priority: number | null;
  is_active: boolean | null;
};

export type ImportPreviewRow = {
  rowNumber: number;
  transaction: Omit<BookkeepingTransaction, "id">;
  error?: string;
  duplicate?: boolean;
};

export type ImportResult = {
  imported: number;
  duplicates: number;
  failed: number;
  total: number;
  errors: { rowNumber: number; error: string }[];
};
