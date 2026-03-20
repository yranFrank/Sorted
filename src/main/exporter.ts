import path from 'node:path';
import { app } from 'electron';
import * as XLSX from 'xlsx';

const expenseCategories = ['Grocery + eating out', 'Insurance', 'Health insurance', 'Transport', 'Bills + council rate', 'Body corp', 'Entertainment', 'Medical', 'Cloth + shopping', 'Internet / phone', 'Education', 'Other (Raise concern)'];
const incomeCategories = ['PAYG income', 'Cash deposit', 'Interest income'];

function monthKey(value: string | null | undefined) {
  if (!value) { return 'Unknown'; }
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (!match) { return 'Unknown'; }
  const year = match[3].length === 2 ? '20' + match[3] : match[3];
  return year + '-' + match[2];
}

function normalizeDateValue(value: string | null | undefined) {
  if (!value) { return null; }
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) { return value; }
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (!match) { return null; }
  const year = match[3].length === 2 ? '20' + match[3] : match[3];
  return `${year}-${match[2]}-${match[1]}`;
}

function isValidRange(start: string | null | undefined, end: string | null | undefined) {
  return !!start && !!end && start <= end;
}

function rangeKey(start: string, end: string) {
  return `${start}..${end}`;
}

function compareTransactionDates(a: any, b: any) {
  const aDate = normalizeDateValue(a.date) || '9999-99-99';
  const bDate = normalizeDateValue(b.date) || '9999-99-99';
  if (aDate !== bDate) { return aDate.localeCompare(bDate); }
  return String(a.created_at || '').localeCompare(String(b.created_at || ''));
}

function groupTotals(rows: any[], categories: string[]) {
  return categories.map((category) => {
    const total = rows.filter((item) => item.category === category).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { category, total };
  });
}

function adjustmentMap(adjustments: any[]) {
  const map = new Map<string, any>();
  for (const item of adjustments) {
    map.set([item.scope_type, item.scope_month || '', item.category].join('::'), item);
  }
  return map;
}

export function exportLivingExpenseWorkbook(data: any) {
  const firstStatement = data.statements[0];
  const confirmedTransactions = data.transactions.filter((tx: any) => tx.status === 'reviewed');
  const exportType = data.exportType || 'overall';
  const exportMonth = data.exportMonth || null;
  const exportRangeStart = data.exportRangeStart || null;
  const exportRangeEnd = data.exportRangeEnd || null;
  const filteredTransactions =
    exportType === 'monthly' && exportMonth
      ? confirmedTransactions.filter((tx: any) => monthKey(tx.date) === exportMonth)
      : exportType === 'custom' && isValidRange(exportRangeStart, exportRangeEnd)
        ? confirmedTransactions.filter((tx: any) => {
            const normalized = normalizeDateValue(tx.date);
            return normalized && normalized >= exportRangeStart && normalized <= exportRangeEnd;
          })
        : confirmedTransactions;
  filteredTransactions.sort(compareTransactionDates);
  const adjustments = data.adjustments || [];
  const adjustmentsByKey = adjustmentMap(adjustments);
  const infoRows = [
    ['Customer name', data.project.customer_name],
    ['Project name', data.project.project_name],
    ['Export mode', exportType],
    ['Export month', exportMonth || 'All months'],
    ['Export range', exportType === 'custom' && exportRangeStart && exportRangeEnd ? `${exportRangeStart} - ${exportRangeEnd}` : 'All dates'],
    ['Account number', firstStatement ? firstStatement.account_number : ''],
    ['Bank name', firstStatement ? firstStatement.bank_name : ''],
    ['Date range', firstStatement ? firstStatement.statement_start_date + ' - ' + firstStatement.statement_end_date : '']
  ];
  const transactionRows = [['Date', 'Category', 'Status', 'Amount']];
  for (const tx of filteredTransactions) {
    transactionRows.push([tx.date, tx.category, tx.status, tx.amount]);
  }
  const summaryRows = [['Scope', 'Direction', 'Category', 'Original total', 'Adjusted total']];
  const scopes =
    exportType === 'monthly'
      ? Array.from(new Set(filteredTransactions.map((item: any) => monthKey(item.date))))
      : exportType === 'custom' && isValidRange(exportRangeStart, exportRangeEnd)
        ? [rangeKey(exportRangeStart, exportRangeEnd)]
        : ['overall'];
  for (const scope of scopes) {
    const scopedRows =
      exportType === 'monthly'
        ? filteredTransactions.filter((item: any) => monthKey(item.date) === scope)
        : exportType === 'custom' && isValidRange(exportRangeStart, exportRangeEnd)
          ? filteredTransactions
          : filteredTransactions;
    for (const row of groupTotals(scopedRows.filter((item: any) => item.debit_credit === 'debit'), expenseCategories)) {
      const adjustment = adjustmentsByKey.get([(exportType === 'monthly' ? 'monthly' : exportType === 'custom' ? 'custom' : 'overall'), exportType === 'overall' ? '' : scope, row.category].join('::'));
      summaryRows.push([scope, 'expense', row.category, row.total, adjustment ? adjustment.adjusted_total : row.total]);
    }
    for (const row of groupTotals(scopedRows.filter((item: any) => item.debit_credit === 'credit'), incomeCategories)) {
      const adjustment = adjustmentsByKey.get([(exportType === 'monthly' ? 'monthly' : exportType === 'custom' ? 'custom' : 'overall'), exportType === 'overall' ? '' : scope, row.category].join('::'));
      summaryRows.push([scope, 'income', row.category, row.total, adjustment ? adjustment.adjusted_total : row.total]);
    }
  }
  const adjustmentRows = [['Scope type', 'Scope month', 'Category', 'Original total', 'Adjusted total', 'Note']];
  for (const item of adjustments) {
    adjustmentRows.push([item.scope_type, item.scope_month || '', item.category, item.original_total, item.adjusted_total, item.note || '']);
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(infoRows), 'Statement Info');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(transactionRows), 'Transactions');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(adjustmentRows), 'Adjustments');
  const downloads = app.getPath('downloads');
  const suffix =
    exportType === 'monthly' && exportMonth
      ? '-' + exportMonth
      : exportType === 'custom' && exportRangeStart && exportRangeEnd
        ? '-' + rangeKey(exportRangeStart, exportRangeEnd).replace(/\.\./g, '-to-')
        : '-overall';
  const filePath = path.join(downloads, 'living-expense-export' + suffix + '.xlsx');
  XLSX.writeFile(workbook, filePath);
  return { filePath: filePath, transactionCount: filteredTransactions.length, exportType: exportType, exportMonth: exportMonth, exportRangeStart: exportRangeStart, exportRangeEnd: exportRangeEnd };
}
