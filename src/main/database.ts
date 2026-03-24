import Database from "better-sqlite3";
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AdjustmentRecord, CategoryGroup, DashboardProject, ExportHistoryRecord, ProjectRecord, RuleRecord, StatementRecord, TransactionRecord } from "./types";

const expenseCategories = [
  "Grocery + eating out",
  "Insurance",
  "Health insurance",
  "Transport",
  "Bills + council rate",
  "Body corp",
  "Entertainment",
  "Medical",
  "Cloth + shopping",
  "Internet / phone",
  "Education",
  "Other (Raise concern)"
];

const incomeCategories = ["PAYG income", "Cash deposit", "Interest income"];

let database: Database.Database | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function getDatabasePath(): string {
  const dbDir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dbDir, { recursive: true });
  return path.join(dbDir, "bank-statement.sqlite");
}

export function getDatabase(): Database.Database {
  if (database) {
    return database;
  }

  database = new Database(getDatabasePath());
  database.pragma("journal_mode = WAL");
  migrate(database);
  seedDefaultRules(database);
  return database;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      project_name TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_opened_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS statements (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      bank_name TEXT,
      customer_name TEXT,
      account_name TEXT,
      account_number TEXT,
      bsb TEXT,
      statement_issue_date TEXT,
      statement_start_date TEXT,
      statement_end_date TEXT,
      parse_status TEXT NOT NULL,
      metadata_status TEXT NOT NULL,
      review_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      statement_id TEXT NOT NULL,
      date TEXT,
      description TEXT,
      amount REAL,
      debit_credit TEXT,
      balance REAL,
      transaction_reference TEXT,
      channel TEXT,
      category TEXT,
      status TEXT NOT NULL DEFAULT 'needs_review',
      reviewed_flag INTEGER NOT NULL DEFAULT 0,
      raw_text TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(statement_id) REFERENCES statements(id)
    );

    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      keyword TEXT NOT NULL,
      category TEXT NOT NULL,
      match_type TEXT NOT NULL,
      priority INTEGER NOT NULL,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS adjustments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      category TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      scope_month TEXT,
      original_total REAL NOT NULL DEFAULT 0,
      adjusted_total REAL NOT NULL DEFAULT 0,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS export_history (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      export_type TEXT NOT NULL,
      export_month TEXT,
      file_path TEXT NOT NULL,
      exported_at TEXT NOT NULL,
      version_label TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS custom_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      group_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);
    CREATE INDEX IF NOT EXISTS idx_statements_project_created ON statements(project_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_statements_project_start ON statements(project_id, statement_start_date);
    CREATE INDEX IF NOT EXISTS idx_transactions_statement_date_created ON transactions(statement_id, date, created_at);
    CREATE INDEX IF NOT EXISTS idx_transactions_statement_status ON transactions(statement_id, status);
    CREATE INDEX IF NOT EXISTS idx_transactions_statement_reviewed ON transactions(statement_id, reviewed_flag);
    CREATE INDEX IF NOT EXISTS idx_rules_enabled_priority_keyword ON rules(is_enabled, priority DESC, keyword);
    CREATE INDEX IF NOT EXISTS idx_adjustments_project_scope_category ON adjustments(project_id, scope_type, scope_month, category);
    CREATE INDEX IF NOT EXISTS idx_export_history_project_exported ON export_history(project_id, exported_at DESC);
  `);
}

function seedDefaultRules(db: Database.Database): void {
  const count = db.prepare("SELECT COUNT(*) AS count FROM rules").get() as { count: number };
  if (count.count > 0) {
    return;
  }

  const insert = db.prepare(`
    INSERT INTO rules (id, keyword, category, match_type, priority, is_enabled, created_at, updated_at)
    VALUES (@id, @keyword, @category, @match_type, @priority, @is_enabled, @created_at, @updated_at)
  `);

  const defaults = [
    { keyword: "coles", category: "Grocery + eating out" },
    { keyword: "woolworths", category: "Grocery + eating out" },
    { keyword: "myki", category: "Transport" },
    { keyword: "medibank", category: "Health insurance" }
  ];

  const createdAt = nowIso();
  const transaction = db.transaction(() => {
    for (const item of defaults) {
      insert.run({
        id: randomUUID(),
        keyword: item.keyword,
        category: item.category,
        match_type: "keyword",
        priority: 100,
        is_enabled: 1,
        created_at: createdAt,
        updated_at: createdAt
      });
    }
  });

  transaction();
}

function normalizeRuleText(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b\d{2,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchRule(description: string | null, rules: RuleRecord[]): RuleRecord | null {
  const normalizedDescription = normalizeRuleText(description);
  for (const rule of rules) {
    if (!rule.is_enabled) {
      continue;
    }
    const normalizedKeyword = normalizeRuleText(rule.keyword);
    if (normalizedKeyword !== "" && normalizedDescription.includes(normalizedKeyword)) {
      return rule;
    }
  }
  return null;
}

function applyRuleSetToTransaction(tx: {
  description: string | null;
  category: string | null;
  status: string;
}) {
  const rules = listRules();
  const matchedRule = matchRule(tx.description, rules);
  if (matchedRule) {
    return { category: matchedRule.category, status: "reviewed" };
  }
  if (!tx.category || tx.category.trim() === "" || tx.category === "Other (Raise concern)") {
    return { category: tx.category || "Other (Raise concern)", status: "needs_review" };
  }
  return { category: tx.category, status: tx.status || "reviewed" };
}

function updateProjectStatusForProject(db: Database.Database, projectId: string, timestamp: string) {
  const unresolved = db.prepare(`
    SELECT COALESCE(SUM(review_count), 0) AS count
    FROM statements
    WHERE project_id = ?
  `).get(projectId) as { count: number };
  const statementCount = db.prepare("SELECT COUNT(*) AS count FROM statements WHERE project_id = ?").get(projectId) as { count: number };
  const status = statementCount.count === 0 ? "draft" : unresolved.count === 0 ? "ready_to_export" : "in_review";
  db.prepare("UPDATE projects SET status = ?, updated_at = ? WHERE id = ?").run(status, timestamp, projectId);
}

function reapplyRulesAcrossTransactions(db: Database.Database) {
  const timestamp = nowIso();
  const rules = listRules();
  const rows = db.prepare("SELECT id, statement_id, description, category, status, reviewed_flag FROM transactions").all() as Array<{ id: string; statement_id: string; description: string | null; category: string | null; status: string; reviewed_flag: number }>;
  const update = db.prepare("UPDATE transactions SET category = ?, status = ?, reviewed_flag = ?, updated_at = ? WHERE id = ?");
  const touchedStatementIds = new Set<string>();
  const tx = db.transaction(() => {
    for (const row of rows) {
      const matchedRule = matchRule(row.description, rules);
      if (!matchedRule) {
        continue;
      }
      const nextCategory = matchedRule.category;
      const nextStatus = "reviewed";
      const nextReviewedFlag = 1;
      if (row.category === nextCategory && row.status === nextStatus && row.reviewed_flag === nextReviewedFlag) {
        continue;
      }
      update.run(nextCategory, nextStatus, nextReviewedFlag, timestamp, row.id);
      touchedStatementIds.add(row.statement_id);
    }
  });
  tx();
  return touchedStatementIds;
}

function reapplyRulesForCandidateKeywords(
  db: Database.Database,
  candidateKeywords: string[],
  fallbackCategory: string | null,
  timestamp: string
) {
  const normalizedCandidates = Array.from(
    new Set(candidateKeywords.map((item) => normalizeRuleText(item)).filter((item) => item !== ""))
  );
  if (normalizedCandidates.length === 0) {
    return new Set<string>();
  }

  const rules = listRules();
  const rows = db
    .prepare("SELECT id, statement_id, description, category, status, reviewed_flag FROM transactions")
    .all() as Array<{
      id: string;
      statement_id: string;
      description: string | null;
      category: string | null;
      status: string;
      reviewed_flag: number;
    }>;

  const update = db.prepare(
    "UPDATE transactions SET category = ?, status = ?, reviewed_flag = ?, updated_at = ? WHERE id = ?"
  );
  const touchedStatementIds = new Set<string>();

  const tx = db.transaction(() => {
    for (const row of rows) {
      const normalizedDescription = normalizeRuleText(row.description);
      const isCandidate = normalizedCandidates.some((keyword) => normalizedDescription.includes(keyword));
      if (!isCandidate) {
        continue;
      }

      const matchedRule = matchRule(row.description, rules);
      if (matchedRule) {
        const nextCategory = matchedRule.category;
        const nextStatus = "reviewed";
        const nextReviewedFlag = 1;
        if (row.category === nextCategory && row.status === nextStatus && row.reviewed_flag === nextReviewedFlag) {
          continue;
        }
        update.run(nextCategory, nextStatus, nextReviewedFlag, timestamp, row.id);
        touchedStatementIds.add(row.statement_id);
        continue;
      }

      if (fallbackCategory !== null && row.category === fallbackCategory && row.status === "reviewed") {
        update.run("Other (Raise concern)", "needs_review", 0, timestamp, row.id);
        touchedStatementIds.add(row.statement_id);
      }
    }
  });

  tx();
  return touchedStatementIds;
}

function refreshStatementReviewCounts(db: Database.Database, statementIds: Iterable<string>, timestamp: string): string[] {
  const uniqueStatementIds = Array.from(new Set(Array.from(statementIds).filter((item) => item !== "")));
  if (uniqueStatementIds.length === 0) {
    return [];
  }

  const placeholders = uniqueStatementIds.map(() => "?").join(", ");
  const unresolvedRows = db
    .prepare(`
      SELECT statement_id, COUNT(*) AS count
      FROM transactions
      WHERE statement_id IN (${placeholders}) AND status != 'reviewed'
      GROUP BY statement_id
    `)
    .all(...uniqueStatementIds) as Array<{ statement_id: string; count: number }>;

  const unresolvedByStatement = new Map(unresolvedRows.map((row) => [row.statement_id, row.count]));
  const updateStatement = db.prepare("UPDATE statements SET review_count = ?, updated_at = ? WHERE id = ?");
  for (const statementId of uniqueStatementIds) {
    updateStatement.run(unresolvedByStatement.get(statementId) || 0, timestamp, statementId);
  }

  return uniqueStatementIds;
}

function refreshProjectsForStatements(db: Database.Database, statementIds: Iterable<string>, timestamp: string) {
  const uniqueStatementIds = Array.from(new Set(Array.from(statementIds).filter((item) => item !== "")));
  if (uniqueStatementIds.length === 0) {
    return;
  }

  const placeholders = uniqueStatementIds.map(() => "?").join(", ");
  const projectRows = db
    .prepare(`
      SELECT DISTINCT project_id
      FROM statements
      WHERE id IN (${placeholders})
    `)
    .all(...uniqueStatementIds) as Array<{ project_id: string }>;

  for (const row of projectRows) {
    updateProjectStatusForProject(db, row.project_id, timestamp);
  }
}

export function createProject(input: { customerName: string; projectName: string }): ProjectRecord {
  const db = getDatabase();
  const timestamp = nowIso();
  const record: ProjectRecord = {
    id: randomUUID(),
    customer_name: input.customerName,
    project_name: input.projectName,
    status: "draft",
    created_at: timestamp,
    updated_at: timestamp,
    last_opened_at: timestamp
  };

  db.prepare(`
    INSERT INTO projects (id, customer_name, project_name, status, created_at, updated_at, last_opened_at)
    VALUES (@id, @customer_name, @project_name, @status, @created_at, @updated_at, @last_opened_at)
  `).run(record);

  return record;
}

export function listProjects(): DashboardProject[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      p.*,
      COALESCE(s.statement_count, 0) AS statement_count,
      COALESCE(t.unresolved_count, 0) AS unresolved_count
    FROM projects p
    LEFT JOIN (
      SELECT project_id, COUNT(*) AS statement_count
      FROM statements
      GROUP BY project_id
    ) s ON s.project_id = p.id
    LEFT JOIN (
      SELECT project_id, COALESCE(SUM(review_count), 0) AS unresolved_count
      FROM statements
      GROUP BY project_id
    ) t ON t.project_id = p.id
    ORDER BY p.updated_at DESC
  `).all() as DashboardProject[];
}

export function touchProject(projectId: string): void {
  const db = getDatabase();
  const timestamp = nowIso();
  db.prepare(`
    UPDATE projects
    SET last_opened_at = ?, updated_at = ?
    WHERE id = ?
  `).run(timestamp, timestamp, projectId);
}

export function addStatements(projectId: string, filePaths: string[]): StatementRecord[] {
  const db = getDatabase();
  const insert = db.prepare(`
    INSERT INTO statements (
      id, project_id, file_name, file_path, bank_name, customer_name, account_name, account_number, bsb,
      statement_issue_date, statement_start_date, statement_end_date, parse_status, metadata_status, review_count,
      created_at, updated_at
    ) VALUES (
      @id, @project_id, @file_name, @file_path, @bank_name, @customer_name, @account_name, @account_number, @bsb,
      @statement_issue_date, @statement_start_date, @statement_end_date, @parse_status, @metadata_status, @review_count,
      @created_at, @updated_at
    )
  `);

  const timestamp = nowIso();
  const created: StatementRecord[] = [];

  const transaction = db.transaction(() => {
    for (const filePath of filePaths) {
      const row: StatementRecord = {
        id: randomUUID(),
        project_id: projectId,
        file_name: path.basename(filePath),
        file_path: filePath,
        bank_name: null,
        customer_name: null,
        account_name: null,
        account_number: null,
        bsb: null,
        statement_issue_date: null,
        statement_start_date: null,
        statement_end_date: null,
        parse_status: "pending",
        metadata_status: "missing_required_fields",
        review_count: 0,
        created_at: timestamp,
        updated_at: timestamp
      };
      insert.run(row);
      created.push(row);
    }
  });

  transaction();
  touchProject(projectId);
  return created;
}

export function listStatementsByProject(projectId: string): StatementRecord[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT *
    FROM statements
    WHERE project_id = ?
    ORDER BY created_at ASC
  `).all(projectId) as StatementRecord[];
}

export function listRules(): RuleRecord[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT *
    FROM rules
    ORDER BY priority DESC, keyword ASC
  `).all() as RuleRecord[];
}

export function getCategories(): CategoryGroup {
  const db = getDatabase();
  const custom = db.prepare("SELECT name, group_name FROM custom_categories ORDER BY created_at ASC").all() as { name: string; group_name: string }[];
  const customExpense = custom.filter((item) => item.group_name === "expense").map((item) => item.name);
  const customIncome = custom.filter((item) => item.group_name === "income").map((item) => item.name);
  return {
    expense: expenseCategories.concat(customExpense),
    income: incomeCategories.concat(customIncome)
  };
}

export function saveStatementParseResult(input: { statementId: string; pageCount: number; rawText: string }) {
  const db = getDatabase();
  const timestamp = nowIso();
  db.exec('CREATE TABLE IF NOT EXISTS statement_parse_results (statement_id TEXT PRIMARY KEY, page_count INTEGER NOT NULL, raw_text TEXT NOT NULL, parsed_at TEXT NOT NULL, FOREIGN KEY(statement_id) REFERENCES statements(id))');
  db.prepare('INSERT INTO statement_parse_results (statement_id, page_count, raw_text, parsed_at) VALUES (?, ?, ?, ?) ON CONFLICT(statement_id) DO UPDATE SET page_count = excluded.page_count, raw_text = excluded.raw_text, parsed_at = excluded.parsed_at').run(input.statementId, input.pageCount, input.rawText, timestamp);
  db.prepare('UPDATE statements SET parse_status = ?, updated_at = ? WHERE id = ?').run('parsed', timestamp, input.statementId);
  return db.prepare('SELECT s.*, r.page_count, r.raw_text, r.parsed_at FROM statements s LEFT JOIN statement_parse_results r ON r.statement_id = s.id WHERE s.id = ?').get(input.statementId);
}

export function storeStatementAnalysis(input: { statementId: string; analysis: any }) {
  const db = getDatabase();
  const timestamp = nowIso();
  db.exec('CREATE TABLE IF NOT EXISTS statement_parse_results (statement_id TEXT PRIMARY KEY, page_count INTEGER NOT NULL, raw_text TEXT NOT NULL, parsed_at TEXT NOT NULL, FOREIGN KEY(statement_id) REFERENCES statements(id))');
  db.prepare('INSERT INTO statement_parse_results (statement_id, page_count, raw_text, parsed_at) VALUES (?, ?, ?, ?) ON CONFLICT(statement_id) DO UPDATE SET page_count = excluded.page_count, raw_text = excluded.raw_text, parsed_at = excluded.parsed_at').run(input.statementId, input.analysis.pages, input.analysis.rawText, timestamp);
  db.prepare('DELETE FROM transactions WHERE statement_id = ?').run(input.statementId);
  const insertTx = db.prepare('INSERT INTO transactions (id, statement_id, date, description, amount, debit_credit, balance, transaction_reference, channel, category, status, reviewed_flag, raw_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const txs = input.analysis.transactions;
  let unresolvedCount = 0;
  for (const tx of txs) {
    const normalized = applyRuleSetToTransaction(tx);
    if (normalized.status !== 'reviewed') { unresolvedCount += 1; }
    insertTx.run(randomUUID(), input.statementId, tx.date, tx.description, tx.amount, tx.debit_credit, tx.balance, tx.transaction_reference, tx.channel, normalized.category, normalized.status, normalized.status == 'reviewed' ? 1 : 0, tx.raw_text, timestamp, timestamp);
  }
  let metadataStatus = 'missing_required_fields';
  if (input.analysis.bsb != '') { if (input.analysis.accountNumber != '') { if (input.analysis.statementStartDate != '') { if (input.analysis.statementEndDate != '') { metadataStatus = 'parsed_partial'; } } } }
  db.prepare('UPDATE statements SET bank_name = ?, account_name = ?, account_number = ?, bsb = ?, statement_start_date = ?, statement_end_date = ?, parse_status = ?, metadata_status = ?, review_count = ?, updated_at = ? WHERE id = ?').run(input.analysis.bankName, input.analysis.accountName, input.analysis.accountNumber, input.analysis.bsb, input.analysis.statementStartDate, input.analysis.statementEndDate, 'parsed', metadataStatus, unresolvedCount, timestamp, input.statementId);
  const project = db.prepare("SELECT project_id FROM statements WHERE id = ?").get(input.statementId) as { project_id: string };
  updateProjectStatusForProject(db, project.project_id, timestamp);
  return db.prepare('SELECT s.*, r.page_count, r.raw_text, r.parsed_at FROM statements s LEFT JOIN statement_parse_results r ON r.statement_id = s.id WHERE s.id = ?').get(input.statementId);
}

function deriveMetadataStatus(input: {
  bank_name: string | null;
  customer_name: string | null;
  account_name: string | null;
  account_number: string | null;
  bsb: string | null;
  statement_issue_date: string | null;
  statement_start_date: string | null;
  statement_end_date: string | null;
}): string {
  const required = [
    input.bank_name,
    input.customer_name,
    input.account_name,
    input.account_number,
    input.bsb,
    input.statement_issue_date,
    input.statement_start_date,
    input.statement_end_date
  ];

  const filledCount = required.filter((item) => item !== null && item.trim() !== "").length;
  if (filledCount === required.length) {
    return "ready";
  }
  if (filledCount > 0) {
    return "parsed_partial";
  }
  return "missing_required_fields";
}

export function updateStatementMetadata(input: {
  statementId: string;
  bank_name: string;
  customer_name: string;
  account_name: string;
  account_number: string;
  bsb: string;
  statement_issue_date: string;
  statement_start_date: string;
  statement_end_date: string;
}) {
  const db = getDatabase();
  const timestamp = nowIso();
  const metadataStatus = deriveMetadataStatus(input);
  db.prepare(`
    UPDATE statements
    SET bank_name = ?,
        customer_name = ?,
        account_name = ?,
        account_number = ?,
        bsb = ?,
        statement_issue_date = ?,
        statement_start_date = ?,
        statement_end_date = ?,
        metadata_status = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    input.bank_name.trim(),
    input.customer_name.trim(),
    input.account_name.trim(),
    input.account_number.trim(),
    input.bsb.trim(),
    input.statement_issue_date.trim(),
    input.statement_start_date.trim(),
    input.statement_end_date.trim(),
    metadataStatus,
    timestamp,
    input.statementId
  );
  return db.prepare("SELECT * FROM statements WHERE id = ?").get(input.statementId);
}

export function updateTransactionClassifications(input: {
  statementId: string;
  updates: Array<{ id: string; category: string; status: string }>;
}): TransactionRecord[] {
  const db = getDatabase();
  const timestamp = nowIso();
  const update = db.prepare(`
    UPDATE transactions
    SET category = ?, status = ?, reviewed_flag = ?, updated_at = ?
    WHERE id = ? AND statement_id = ?
  `);
  const transaction = db.transaction(() => {
    for (const item of input.updates) {
      update.run(item.category, item.status, item.status === "reviewed" ? 1 : 0, timestamp, item.id, input.statementId);
    }
  });
  transaction();
  const unresolvedCount = db.prepare("SELECT COUNT(*) AS count FROM transactions WHERE statement_id = ? AND status != 'reviewed'").get(input.statementId) as { count: number };
  const statement = db.prepare("SELECT project_id FROM statements WHERE id = ?").get(input.statementId) as { project_id: string };
  db.prepare("UPDATE statements SET review_count = ?, updated_at = ? WHERE id = ?").run(unresolvedCount.count, timestamp, input.statementId);
  updateProjectStatusForProject(db, statement.project_id, timestamp);
  return db.prepare("SELECT * FROM transactions WHERE statement_id = ? ORDER BY created_at ASC").all(input.statementId) as TransactionRecord[];
}

export function listTransactionsByProject(projectId: string): TransactionRecord[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT t.*
    FROM transactions t
    INNER JOIN statements s ON s.id = t.statement_id
    WHERE s.project_id = ?
    ORDER BY t.date ASC, t.created_at ASC
  `).all(projectId) as TransactionRecord[];
}

export function createCategory(input: { name: string; group_name: string }): { name: string; group_name: string } {
  const db = getDatabase();
  const timestamp = nowIso();
  const name = input.name.trim();
  db.prepare(`
    INSERT INTO custom_categories (id, name, group_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET group_name = excluded.group_name, updated_at = excluded.updated_at
  `).run(randomUUID(), name, input.group_name, timestamp, timestamp);
  return { name, group_name: input.group_name };
}

export function createRule(input: { keyword: string; category: string; match_type: string; priority?: number }) {
  const db = getDatabase();
  const timestamp = nowIso();
  const rule: RuleRecord = {
    id: randomUUID(),
    keyword: normalizeRuleText(input.keyword),
    category: input.category.trim(),
    match_type: input.match_type,
    priority: input.priority ?? 100,
    is_enabled: 1,
    created_at: timestamp,
    updated_at: timestamp
  };
  db.prepare(`
    INSERT INTO rules (id, keyword, category, match_type, priority, is_enabled, created_at, updated_at)
    VALUES (@id, @keyword, @category, @match_type, @priority, @is_enabled, @created_at, @updated_at)
  `).run(rule);
  const touchedStatementIds = reapplyRulesAcrossTransactions(db);
  refreshStatementReviewCounts(db, touchedStatementIds, timestamp);
  refreshProjectsForStatements(db, touchedStatementIds, timestamp);
  return rule;
}

export function updateRule(input: { id: string; keyword: string; category: string; is_enabled: number }) {
  const db = getDatabase();
  const timestamp = nowIso();
  const previous = db.prepare("SELECT * FROM rules WHERE id = ?").get(input.id) as RuleRecord | undefined;
  db.prepare(`
    UPDATE rules
    SET keyword = ?, category = ?, is_enabled = ?, updated_at = ?
    WHERE id = ?
  `).run(normalizeRuleText(input.keyword), input.category.trim(), input.is_enabled, timestamp, input.id);
  const touchedStatementIds =
    previous
      ? reapplyRulesForCandidateKeywords(
          db,
          [previous.keyword, input.keyword],
          previous.category,
          timestamp
        )
      : reapplyRulesAcrossTransactions(db);
  refreshStatementReviewCounts(db, touchedStatementIds, timestamp);
  refreshProjectsForStatements(db, touchedStatementIds, timestamp);
  return db.prepare("SELECT * FROM rules WHERE id = ?").get(input.id) as RuleRecord;
}

export function deleteRule(ruleId: string): void {
  const db = getDatabase();
  const timestamp = nowIso();
  const previous = db.prepare("SELECT * FROM rules WHERE id = ?").get(ruleId) as RuleRecord | undefined;
  db.prepare("DELETE FROM rules WHERE id = ?").run(ruleId);
  const touchedStatementIds =
    previous
      ? reapplyRulesForCandidateKeywords(db, [previous.keyword], previous.category, timestamp)
      : reapplyRulesAcrossTransactions(db);
  refreshStatementReviewCounts(db, touchedStatementIds, timestamp);
  refreshProjectsForStatements(db, touchedStatementIds, timestamp);
}

export function listAdjustmentsByProject(projectId: string): AdjustmentRecord[] {
  const db = getDatabase();
  return db.prepare("SELECT * FROM adjustments WHERE project_id = ? ORDER BY scope_type ASC, scope_month ASC, category ASC").all(projectId) as AdjustmentRecord[];
}

export function upsertAdjustment(input: {
  project_id: string;
  category: string;
  scope_type: string;
  scope_month: string | null;
  original_total: number;
  adjusted_total: number;
  note: string;
}) {
  const db = getDatabase();
  const timestamp = nowIso();
  const existing = db.prepare("SELECT id FROM adjustments WHERE project_id = ? AND category = ? AND scope_type = ? AND COALESCE(scope_month, '') = COALESCE(?, '')").get(input.project_id, input.category, input.scope_type, input.scope_month) as { id: string } | undefined;
  if (existing) {
    db.prepare(`
      UPDATE adjustments
      SET original_total = ?, adjusted_total = ?, note = ?, updated_at = ?
      WHERE id = ?
    `).run(input.original_total, input.adjusted_total, input.note.trim(), timestamp, existing.id);
    return db.prepare("SELECT * FROM adjustments WHERE id = ?").get(existing.id) as AdjustmentRecord;
  }
  const id = randomUUID();
  db.prepare(`
    INSERT INTO adjustments (id, project_id, category, scope_type, scope_month, original_total, adjusted_total, note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.project_id, input.category, input.scope_type, input.scope_month, input.original_total, input.adjusted_total, input.note.trim(), timestamp, timestamp);
  return db.prepare("SELECT * FROM adjustments WHERE id = ?").get(id) as AdjustmentRecord;
}

export function listExportHistoryByProject(projectId: string): ExportHistoryRecord[] {
  const db = getDatabase();
  return db.prepare("SELECT * FROM export_history WHERE project_id = ? ORDER BY exported_at DESC").all(projectId) as ExportHistoryRecord[];
}

export function recordExportHistory(input: {
  project_id: string;
  export_type: string;
  export_month: string | null;
  file_path: string;
  version_label: string | null;
}) {
  const db = getDatabase();
  const row: ExportHistoryRecord = {
    id: randomUUID(),
    project_id: input.project_id,
    export_type: input.export_type,
    export_month: input.export_month,
    file_path: input.file_path,
    exported_at: nowIso(),
    version_label: input.version_label
  };
  db.prepare(`
    INSERT INTO export_history (id, project_id, export_type, export_month, file_path, exported_at, version_label)
    VALUES (@id, @project_id, @export_type, @export_month, @file_path, @exported_at, @version_label)
  `).run(row);
  db.prepare("UPDATE projects SET status = ?, updated_at = ? WHERE id = ?").run("exported", row.exported_at, row.project_id);
  return row;
}

export function getProjectExportData(projectId: string) {
  const db = getDatabase();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  const statements = db.prepare('SELECT * FROM statements WHERE project_id = ? ORDER BY statement_start_date ASC, created_at ASC').all(projectId);
  const transactions = db.prepare('SELECT t.*, s.file_name FROM transactions t INNER JOIN statements s ON s.id = t.statement_id WHERE s.project_id = ? ORDER BY t.date ASC, t.created_at ASC').all(projectId);
  const adjustments = listAdjustmentsByProject(projectId);
  const exportHistory = listExportHistoryByProject(projectId);
  return { project: project, statements: statements, transactions: transactions, adjustments: adjustments, exportHistory: exportHistory };
}
