import { contextBridge, ipcRenderer } from 'electron'; 
 
const api = { 
  listProjects: function () { return ipcRenderer.invoke('projects:list'); }, 
  createProject: function (payload: { customerName: string; projectName: string }) { return ipcRenderer.invoke('projects:create', payload); }, 
  openProject: function (projectId: string) { return ipcRenderer.invoke('projects:open', projectId); }, 
  pickStatementFiles: function () { return ipcRenderer.invoke('statements:pick-files'); }, 
  addStatements: function (payload: { projectId: string; filePaths: string[] }) { return ipcRenderer.invoke('statements:add', payload); }, 
  parseStatement: function (filePath: string) { return ipcRenderer.invoke('statements:parse', filePath); }, 
  analyzeStatementPreview: function (filePath: string) { return ipcRenderer.invoke('statements:analyze-preview', filePath); }, 
  parseAndStoreStatement: function (payload: { statementId: string; filePath: string }) { return ipcRenderer.invoke('statements:parse-and-store', payload); }, 
  updateStatementMetadata: function (payload: { statementId: string; bank_name: string; customer_name: string; account_name: string; account_number: string; bsb: string; statement_issue_date: string; statement_start_date: string; statement_end_date: string }) { return ipcRenderer.invoke('statements:update-metadata', payload); },
  updateTransactionClassifications: function (payload: { statementId: string; updates: Array<{ id: string; category: string; status: string }> }) { return ipcRenderer.invoke('transactions:update-classifications', payload); },
  createCategory: function (payload: { name: string; group_name: string }) { return ipcRenderer.invoke('categories:create', payload); },
  exportLivingExpense: function (payload: { projectId: string; exportType: string; exportMonth: string | null; versionLabel: string | null }) { return ipcRenderer.invoke('projects:export-living-expense', payload); }, 
  listRules: function () { return ipcRenderer.invoke('rules:list'); }, 
  createRule: function (payload: { keyword: string; category: string; match_type: string; priority?: number }) { return ipcRenderer.invoke('rules:create', payload); },
  updateRule: function (payload: { id: string; keyword: string; category: string; is_enabled: number }) { return ipcRenderer.invoke('rules:update', payload); },
  deleteRule: function (ruleId: string) { return ipcRenderer.invoke('rules:delete', ruleId); },
  getCategories: function () { return ipcRenderer.invoke('categories:get'); },
  upsertAdjustment: function (payload: { project_id: string; category: string; scope_type: string; scope_month: string | null; original_total: number; adjusted_total: number; note: string }) { return ipcRenderer.invoke('adjustments:upsert', payload); },
  listExportHistory: function (projectId: string) { return ipcRenderer.invoke('projects:export-history', projectId); }
}; 
 
contextBridge.exposeInMainWorld('bankApp', api); 
 
export type BankAppApi = typeof api;
