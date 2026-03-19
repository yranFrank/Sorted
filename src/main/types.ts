export type ProjectStatus = "draft" | "in_review" | "ready_to_export" | "exported";

export type ProjectRecord = {
  id: string;
  customer_name: string;
  project_name: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
};

export type StatementRecord = {
  id: string;
  project_id: string;
  file_name: string;
  file_path: string;
  bank_name: string | null;
  customer_name: string | null;
  account_name: string | null;
  account_number: string | null;
  bsb: string | null;
  statement_issue_date: string | null;
  statement_start_date: string | null;
  statement_end_date: string | null;
  parse_status: string;
  metadata_status: string;
  review_count: number;
  created_at: string;
  updated_at: string;
};

export type RuleRecord = {
  id: string;
  keyword: string;
  category: string;
  match_type: string;
  priority: number;
  is_enabled: number;
  created_at: string;
  updated_at: string;
};

export type TransactionRecord = {
  id: string;
  statement_id: string;
  date: string | null;
  description: string | null;
  amount: number | null;
  debit_credit: string | null;
  balance: number | null;
  transaction_reference: string | null;
  channel: string | null;
  category: string | null;
  status: string;
  reviewed_flag: number;
  raw_text: string | null;
  created_at: string;
  updated_at: string;
};

export type AdjustmentRecord = {
  id: string;
  project_id: string;
  category: string;
  scope_type: string;
  scope_month: string | null;
  original_total: number;
  adjusted_total: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type ExportHistoryRecord = {
  id: string;
  project_id: string;
  export_type: string;
  export_month: string | null;
  file_path: string;
  exported_at: string;
  version_label: string | null;
};

export type CategoryGroup = {
  expense: string[];
  income: string[];
};

export type DashboardProject = ProjectRecord & {
  statement_count: number;
  unresolved_count: number;
};
