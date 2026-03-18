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
  exportLivingExpense: function (projectId: string) { return ipcRenderer.invoke('projects:export-living-expense', projectId); }, 
  listRules: function () { return ipcRenderer.invoke('rules:list'); }, 
  getCategories: function () { return ipcRenderer.invoke('categories:get'); } 
}; 
 
contextBridge.exposeInMainWorld('bankApp', api); 
 
export type BankAppApi = typeof api;
