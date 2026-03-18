import { BrowserWindow, dialog, ipcMain } from 'electron'; 
import { addStatements, createProject, getCategories, getProjectExportData, listProjects, listRules, listStatementsByProject, storeStatementAnalysis, touchProject } from './database'; 
import { exportLivingExpenseWorkbook } from './exporter'; 
import { analyzeStatement, parseStatement } from './parser'; 
 
export function registerIpc(mainWindow: BrowserWindow): void { 
  ipcMain.handle('projects:list', function () { return listProjects(); }); 
  ipcMain.handle('projects:create', function (_event, payload: { customerName: string; projectName: string }) { return createProject(payload); }); 
  ipcMain.handle('projects:open', function (_event, projectId: string) { touchProject(projectId); return { statements: listStatementsByProject(projectId), rules: listRules(), categories: getCategories() }; }); 
  ipcMain.handle('statements:pick-files', async function () { const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'PDF Statements', extensions: ['pdf'] }] }); if (result.canceled) { return []; } return result.filePaths; }); 
  ipcMain.handle('statements:add', async function (_event, payload: { projectId: string; filePaths: string[] }) { const created = addStatements(payload.projectId, payload.filePaths); for (const statement of created) { const analysis = await analyzeStatement(statement.file_path); storeStatementAnalysis({ statementId: statement.id, analysis: analysis }); } return created; }); 
  ipcMain.handle('statements:parse', async function (_event, filePath: string) { return parseStatement(filePath); }); 
  ipcMain.handle('statements:analyze-preview', async function (_event, filePath: string) { return analyzeStatement(filePath); }); 
  ipcMain.handle('statements:parse-and-store', async function (_event, payload: { statementId: string; filePath: string }) { const analysis = await analyzeStatement(payload.filePath); return storeStatementAnalysis({ statementId: payload.statementId, analysis: analysis }); }); 
  ipcMain.handle('projects:export-living-expense', function (_event, projectId: string) { const data = getProjectExportData(projectId); return exportLivingExpenseWorkbook(data); }); 
  ipcMain.handle('rules:list', function () { return listRules(); }); 
  ipcMain.handle('categories:get', function () { return getCategories(); }); 
}
