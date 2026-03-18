import path from 'node:path';
import { app } from 'electron';
import * as XLSX from 'xlsx';

const expenseCategories = ['Grocery + eating out', 'Insurance', 'Health insurance', 'Transport', 'Bills + council rate', 'Body corp', 'Entertainment', 'Medical', 'Cloth + shopping', 'Internet / phone', 'Education', 'Other (Raise concern)'];
const incomeCategories = ['PAYG income', 'Cash deposit', 'Interest income'];

export function exportLivingExpenseWorkbook(data: any) {
  const firstStatement = data.statements[0];
  const expenseRows = [];
  expenseRows.push(['Customer name', data.project.customer_name]);
  expenseRows.push(['Account number', firstStatement ? firstStatement.account_number : '']);
  expenseRows.push(['Date', firstStatement ? firstStatement.statement_start_date + ' - ' + firstStatement.statement_end_date : '']);
  expenseRows.push(['Date'].concat(expenseCategories));
  for (const tx of data.transactions) {
    if (tx.debit_credit != 'debit') { continue; }
    const row = [tx.date];
    for (const category of expenseCategories) { if (tx.category == category) { row.push(tx.amount); } else { row.push(''); } }
    expenseRows.push(row);
  }
  const incomeRows = [];
  incomeRows.push(['Date', 'Category', 'Amount', 'Description']);
  for (const tx of data.transactions) { if (tx.debit_credit == 'credit') { incomeRows.push([tx.date, tx.category, tx.amount, tx.description]); } }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(expenseRows), '90 days transactions');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(incomeRows), 'Income');
  const downloads = app.getPath('downloads');
  const filePath = path.join(downloads, 'living-expense-export.xlsx');
  XLSX.writeFile(workbook, filePath);
  return { filePath: filePath, expenseCount: expenseRows.length - 4, incomeCount: incomeRows.length - 1, supportedIncomeCategories: incomeCategories.length };
}
