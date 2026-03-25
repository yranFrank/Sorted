import { BrowserWindow, dialog, ipcMain, shell } from "electron";
import { readFile } from "node:fs/promises";
import {
  addStatements,
  createCategory,
  createProject,
  createRule,
  deleteRule,
  getCategories,
  getProjectExportData,
  listAdjustmentsByProject,
  listExportHistoryByProject,
  listProjects,
  listRules,
  listStatementsByProject,
  listTransactionsByProject,
  recordExportHistory,
  storeStatementAnalysis,
  touchProject,
  updateRule,
  updateStatementMetadata,
  updateTransactionClassifications,
  upsertAdjustment
} from "./database";
import { exportLivingExpenseWorkbook } from "./exporter";
import { analyzeStatement, parseStatement } from "./parser";

type ProjectCreatePayload = { customerName: string; projectName: string };
type StatementAddPayload = { projectId: string; filePaths: string[] };
type ParseAndStorePayload = { statementId: string; filePath: string };
type StatementMetadataPayload = {
  statementId: string;
  bank_name: string;
  customer_name: string;
  account_name: string;
  account_number: string;
  bsb: string;
  statement_issue_date: string;
  statement_start_date: string;
  statement_end_date: string;
};
type TransactionClassificationPayload = {
  statementId: string;
  updates: Array<{ id: string; category: string; status: string }>;
};
type RuleCreatePayload = {
  keyword: string;
  category: string;
  match_type: string;
  priority?: number;
};
type RuleUpdatePayload = {
  id: string;
  keyword: string;
  category: string;
  is_enabled: number;
};
type AdjustmentUpsertPayload = {
  project_id: string;
  category: string;
  scope_type: string;
  scope_month: string | null;
  original_total: number;
  adjusted_total: number;
  note: string;
};
type ExportPayload = {
  projectId: string;
  exportType: string;
  exportMonth: string | null;
  exportRangeStart: string | null;
  exportRangeEnd: string | null;
  versionLabel: string | null;
};

function buildProjectWorkspace(projectId: string) {
  touchProject(projectId);
  return {
    statements: listStatementsByProject(projectId),
    transactions: listTransactionsByProject(projectId),
    rules: listRules(),
    categories: getCategories(),
    adjustments: listAdjustmentsByProject(projectId),
    exportHistory: listExportHistoryByProject(projectId)
  };
}

async function pickStatementFiles(mainWindow: BrowserWindow) {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "PDF Statements", extensions: ["pdf"] }]
  });
  return result.canceled ? [] : result.filePaths;
}

async function addAndAnalyzeStatements(payload: StatementAddPayload) {
  const created = addStatements(payload.projectId, payload.filePaths);
  for (const statement of created) {
    const analysis = await analyzeStatement(statement.file_path);
    storeStatementAnalysis({ statementId: statement.id, analysis });
  }
  return created;
}

async function readPdfBytes(filePath: string) {
  const buffer = await readFile(filePath);
  return new Uint8Array(buffer);
}

async function parseAndStoreStatement(payload: ParseAndStorePayload) {
  const analysis = await analyzeStatement(payload.filePath);
  return storeStatementAnalysis({ statementId: payload.statementId, analysis });
}

async function openGoogleSearch(query: string) {
  const url = "https://www.google.com/search?q=" + encodeURIComponent(query);
  await shell.openExternal(url);
  return { ok: true, url };
}

function exportProjectWorkbook(payload: ExportPayload) {
  const data = getProjectExportData(payload.projectId);
  const result = exportLivingExpenseWorkbook({
    ...data,
    exportType: payload.exportType,
    exportMonth: payload.exportMonth,
    exportRangeStart: payload.exportRangeStart,
    exportRangeEnd: payload.exportRangeEnd,
    versionLabel: payload.versionLabel
  });

  recordExportHistory({
    project_id: payload.projectId,
    export_type: payload.exportType,
    export_month:
      payload.exportType === "custom" && payload.exportRangeStart && payload.exportRangeEnd
        ? `${payload.exportRangeStart}..${payload.exportRangeEnd}`
        : payload.exportMonth,
    file_path: result.filePath,
    version_label: payload.versionLabel
  });

  return result;
}

export function registerIpc(mainWindow: BrowserWindow): void {
  ipcMain.handle("projects:list", () => listProjects());
  ipcMain.handle("projects:create", (_event, payload: ProjectCreatePayload) => createProject(payload));
  ipcMain.handle("projects:open", (_event, projectId: string) => buildProjectWorkspace(projectId));
  ipcMain.handle("projects:export-history", (_event, projectId: string) =>
    listExportHistoryByProject(projectId)
  );
  ipcMain.handle("projects:export-living-expense", (_event, payload: ExportPayload) =>
    exportProjectWorkbook(payload)
  );

  ipcMain.handle("statements:pick-files", () => pickStatementFiles(mainWindow));
  ipcMain.handle("statements:add", (_event, payload: StatementAddPayload) =>
    addAndAnalyzeStatements(payload)
  );
  ipcMain.handle("statements:parse", (_event, filePath: string) => parseStatement(filePath));
  ipcMain.handle("statements:read-pdf", (_event, filePath: string) => readPdfBytes(filePath));
  ipcMain.handle("statements:analyze-preview", (_event, filePath: string) => analyzeStatement(filePath));
  ipcMain.handle("statements:parse-and-store", (_event, payload: ParseAndStorePayload) =>
    parseAndStoreStatement(payload)
  );
  ipcMain.handle("statements:update-metadata", (_event, payload: StatementMetadataPayload) =>
    updateStatementMetadata(payload)
  );

  ipcMain.handle(
    "transactions:update-classifications",
    (_event, payload: TransactionClassificationPayload) =>
      updateTransactionClassifications(payload)
  );
  ipcMain.handle("search:google-transaction", (_event, query: string) => openGoogleSearch(query));

  ipcMain.handle("categories:create", (_event, payload: { name: string; group_name: string }) => {
    createCategory(payload);
    return getCategories();
  });
  ipcMain.handle("categories:get", () => getCategories());

  ipcMain.handle("rules:list", () => listRules());
  ipcMain.handle("rules:create", (_event, payload: RuleCreatePayload) => createRule(payload));
  ipcMain.handle("rules:update", (_event, payload: RuleUpdatePayload) => updateRule(payload));
  ipcMain.handle("rules:delete", (_event, ruleId: string) => {
    deleteRule(ruleId);
    return { ok: true };
  });

  ipcMain.handle("adjustments:upsert", (_event, payload: AdjustmentUpsertPayload) =>
    upsertAdjustment(payload)
  );
}
