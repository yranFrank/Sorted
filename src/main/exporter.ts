import path from "node:path";
import { app } from "electron";
import * as XLSX from "xlsx";
import {
  categoryTotals,
  filterTransactionsByScope,
  rangeKey,
  sortTransactionsByDate,
  transactionDateSpan,
  type ScopeMode
} from "../shared/transaction-scope";

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

function adjustmentMap(adjustments: any[]) {
  const map = new Map<string, any>();
  for (const item of adjustments) {
    map.set([item.scope_type, item.scope_month || "", item.category].join("::"), item);
  }
  return map;
}

export function exportLivingExpenseWorkbook(data: any) {
  const firstStatement = data.statements[0];
  const confirmedTransactions = data.transactions.filter((tx: any) => tx.status === 'reviewed');
  const exportType = (data.exportType || "overall") as ScopeMode;
  const exportMonth = data.exportMonth || null;
  const exportRangeStart = data.exportRangeStart || null;
  const exportRangeEnd = data.exportRangeEnd || null;
  const filteredTransactions = sortTransactionsByDate(
    filterTransactionsByScope({
      mode: exportType,
      transactions: confirmedTransactions,
      selectedMonth: exportMonth,
      rangeStart: exportRangeStart,
      rangeEnd: exportRangeEnd
    })
  );
  const adjustments = data.adjustments || [];
  const adjustmentsByKey = adjustmentMap(adjustments);
  const infoRows = [
    ["Customer name", data.project.customer_name],
    ["Project name", data.project.project_name],
    ["Export mode", exportType],
    ["Export month", exportMonth || "All months"],
    [
      "Export range",
      exportType === "custom" && exportRangeStart && exportRangeEnd
        ? `${exportRangeStart} - ${exportRangeEnd}`
        : "All dates"
    ],
    ["Account number", firstStatement ? firstStatement.account_number : ""],
    ["Bank name", firstStatement ? firstStatement.bank_name : ""],
    ["Date range", transactionDateSpan(filteredTransactions).label]
  ];
  const transactionRows = [["Date", "Category", "Status", "Amount"]];
  for (const tx of filteredTransactions) {
    transactionRows.push([tx.date, tx.category, tx.status, tx.amount]);
  }
  const summaryRows = [["Scope", "Direction", "Category", "Original total", "Adjusted total"]];
  const scopes =
    exportType === "custom" && exportRangeStart && exportRangeEnd
      ? [rangeKey(exportRangeStart, exportRangeEnd)]
      : [exportType === "monthly" ? exportMonth || "Unknown" : "overall"];
  for (const scope of scopes) {
    for (const row of categoryTotals(filteredTransactions.filter((item: any) => item.debit_credit === "debit"), expenseCategories)) {
      const adjustment = adjustmentsByKey.get(
        [
          exportType === "monthly" ? "monthly" : exportType === "custom" ? "custom" : "overall",
          exportType === "overall" ? "" : scope,
          row.category
        ].join("::")
      );
      summaryRows.push([scope, "expense", row.category, row.total, adjustment ? adjustment.adjusted_total : row.total]);
    }
    for (const row of categoryTotals(filteredTransactions.filter((item: any) => item.debit_credit === "credit"), incomeCategories)) {
      const adjustment = adjustmentsByKey.get(
        [
          exportType === "monthly" ? "monthly" : exportType === "custom" ? "custom" : "overall",
          exportType === "overall" ? "" : scope,
          row.category
        ].join("::")
      );
      summaryRows.push([scope, "income", row.category, row.total, adjustment ? adjustment.adjusted_total : row.total]);
    }
  }
  const adjustmentRows = [["Scope type", "Scope month", "Category", "Original total", "Adjusted total", "Note"]];
  for (const item of adjustments) {
    adjustmentRows.push([item.scope_type, item.scope_month || "", item.category, item.original_total, item.adjusted_total, item.note || ""]);
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(infoRows), "Statement Info");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(transactionRows), "Transactions");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(adjustmentRows), "Adjustments");
  const downloads = app.getPath("downloads");
  const suffix =
    exportType === "monthly" && exportMonth
      ? "-" + exportMonth
      : exportType === "custom" && exportRangeStart && exportRangeEnd
        ? "-" + rangeKey(exportRangeStart, exportRangeEnd).replace(/\.\./g, "-to-")
        : "-overall";
  const filePath = path.join(downloads, "living-expense-export" + suffix + ".xlsx");
  XLSX.writeFile(workbook, filePath);
  return {
    filePath,
    transactionCount: filteredTransactions.length,
    exportType,
    exportMonth,
    exportRangeStart,
    exportRangeEnd
  };
}
