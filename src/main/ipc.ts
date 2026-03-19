import { BrowserWindow, dialog, ipcMain } from 'electron'; 
import { addStatements, createCategory, createProject, createRule, deleteRule, getCategories, getProjectExportData, listAdjustmentsByProject, listExportHistoryByProject, listProjects, listRules, listStatementsByProject, listTransactionsByProject, recordExportHistory, storeStatementAnalysis, touchProject, updateRule, updateStatementMetadata, updateTransactionClassifications, upsertAdjustment } from './database'; 
import { exportLivingExpenseWorkbook } from './exporter'; 
import { analyzeStatement, parseStatement } from './parser'; 
 
export function registerIpc(mainWindow: BrowserWindow): void { 
  ipcMain.handle('projects:list', function () { return listProjects(); }); 
  ipcMain.handle('projects:create', function (_event, payload: { customerName: string; projectName: string }) { return createProject(payload); }); 
  ipcMain.handle('projects:open', function (_event, projectId: string) { touchProject(projectId); return { statements: listStatementsByProject(projectId), transactions: listTransactionsByProject(projectId), rules: listRules(), categories: getCategories(), adjustments: listAdjustmentsByProject(projectId), exportHistory: listExportHistoryByProject(projectId) }; }); 
  ipcMain.handle('statements:pick-files', async function () { const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'PDF Statements', extensions: ['pdf'] }] }); if (result.canceled) { return []; } return result.filePaths; }); 
  ipcMain.handle('statements:add', async function (_event, payload: { projectId: string; filePaths: string[] }) { const created = addStatements(payload.projectId, payload.filePaths); for (const statement of created) { const analysis = await analyzeStatement(statement.file_path); storeStatementAnalysis({ statementId: statement.id, analysis: analysis }); } return created; }); 
  ipcMain.handle('statements:parse', async function (_event, filePath: string) { return parseStatement(filePath); }); 
  ipcMain.handle('statements:analyze-preview', async function (_event, filePath: string) { return analyzeStatement(filePath); }); 
  ipcMain.handle('statements:parse-and-store', async function (_event, payload: { statementId: string; filePath: string }) { const analysis = await analyzeStatement(payload.filePath); return storeStatementAnalysis({ statementId: payload.statementId, analysis: analysis }); }); 
  ipcMain.handle('statements:update-metadata', function (_event, payload: { statementId: string; bank_name: string; customer_name: string; account_name: string; account_number: string; bsb: string; statement_issue_date: string; statement_start_date: string; statement_end_date: string }) { return updateStatementMetadata(payload); });
  ipcMain.handle('transactions:update-classifications', function (_event, payload: { statementId: string; updates: Array<{ id: string; category: string; status: string }> }) { return updateTransactionClassifications(payload); });
  ipcMain.handle('categories:create', function (_event, payload: { name: string; group_name: string }) { createCategory(payload); return getCategories(); });
  ipcMain.handle('rules:create', function (_event, payload: { keyword: string; category: string; match_type: string; priority?: number }) { return createRule(payload); });
  ipcMain.handle('rules:update', function (_event, payload: { id: string; keyword: string; category: string; is_enabled: number }) { return updateRule(payload); });
  ipcMain.handle('rules:delete', function (_event, ruleId: string) { deleteRule(ruleId); return { ok: true }; });
  ipcMain.handle('adjustments:upsert', function (_event, payload: { project_id: string; category: string; scope_type: string; scope_month: string | null; original_total: number; adjusted_total: number; note: string }) { return upsertAdjustment(payload); });
  ipcMain.handle('projects:export-living-expense', function (_event, payload: { projectId: string; exportType: string; exportMonth: string | null; versionLabel: string | null }) { const data = getProjectExportData(payload.projectId); const result = exportLivingExpenseWorkbook({ ...data, exportType: payload.exportType, exportMonth: payload.exportMonth, versionLabel: payload.versionLabel }); recordExportHistory({ project_id: payload.projectId, export_type: payload.exportType, export_month: payload.exportMonth, file_path: result.filePath, version_label: payload.versionLabel }); return result; }); 
  ipcMain.handle('rules:list', function () { return listRules(); }); 
  ipcMain.handle('categories:get', function () { return getCategories(); }); 
  ipcMain.handle('projects:export-history', function (_event, projectId: string) { return listExportHistoryByProject(projectId); });
}
