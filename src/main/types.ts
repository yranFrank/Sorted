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

export type CategoryGroup = {
  expense: string[];
  income: string[];
};

export type DashboardProject = ProjectRecord & {
  statement_count: number;
  unresolved_count: number;
};
