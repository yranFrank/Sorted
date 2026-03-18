import Database from "better-sqlite3";
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { CategoryGroup, DashboardProject, ProjectRecord, RuleRecord, StatementRecord } from "./types";

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
      COUNT(DISTINCT s.id) AS statement_count,
      COALESCE(SUM(CASE WHEN t.status = 'needs_review' THEN 1 ELSE 0 END), 0) AS unresolved_count
    FROM projects p
    LEFT JOIN statements s ON s.project_id = p.id
    LEFT JOIN transactions t ON t.statement_id = s.id
    GROUP BY p.id
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
  return {
    expense: expenseCategories,
    income: incomeCategories
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
  for (const tx of txs) { insertTx.run(randomUUID(), input.statementId, tx.date, tx.description, tx.amount, tx.debit_credit, tx.balance, tx.transaction_reference, tx.channel, tx.category, tx.status, tx.status == 'reviewed' ? 1 : 0, tx.raw_text, timestamp, timestamp); }
  let metadataStatus = 'missing_required_fields';
  if (input.analysis.bsb != '') { if (input.analysis.accountNumber != '') { if (input.analysis.statementStartDate != '') { if (input.analysis.statementEndDate != '') { metadataStatus = 'parsed_partial'; } } } }
  db.prepare('UPDATE statements SET bank_name = ?, account_name = ?, account_number = ?, bsb = ?, statement_start_date = ?, statement_end_date = ?, parse_status = ?, metadata_status = ?, review_count = ?, updated_at = ? WHERE id = ?').run(input.analysis.bankName, input.analysis.accountName, input.analysis.accountNumber, input.analysis.bsb, input.analysis.statementStartDate, input.analysis.statementEndDate, 'parsed', metadataStatus, txs.length, timestamp, input.statementId);
  return db.prepare('SELECT s.*, r.page_count, r.raw_text, r.parsed_at FROM statements s LEFT JOIN statement_parse_results r ON r.statement_id = s.id WHERE s.id = ?').get(input.statementId);
}

export function getProjectExportData(projectId: string) {
  const db = getDatabase();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  const statements = db.prepare('SELECT * FROM statements WHERE project_id = ? ORDER BY statement_start_date ASC, created_at ASC').all(projectId);
  const transactions = db.prepare('SELECT t.*, s.file_name FROM transactions t INNER JOIN statements s ON s.id = t.statement_id WHERE s.project_id = ? ORDER BY t.date ASC, t.created_at ASC').all(projectId);
  return { project: project, statements: statements, transactions: transactions };
}
