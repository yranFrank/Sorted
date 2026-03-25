import type { RuleRecord, TransactionRecord } from "./types";
export {
  categoryTotals,
  filterTransactionsByRange,
  isValidRange,
  monthKey,
  normalizeDateValue,
  rangeKey,
  rangeLabel,
  safeNumber,
  sortTransactionsByDate,
  totalByDirection,
  transactionDateSpan,
  unresolvedCount,
  type ScopeMode as SummaryMode
} from "../../shared/transaction-scope";
import {
  categoryTotals,
  filterTransactionsByRange,
  isValidRange,
  monthKey,
  rangeKey,
  rangeLabel,
  sortTransactionsByDate,
  totalByDirection,
  transactionDateSpan,
  unresolvedCount,
  type ScopeMode as SummaryMode
} from "../../shared/transaction-scope";

export type ClassificationModel = {
  selectedTransactions: TransactionRecord[];
  selectedReviewTransaction: TransactionRecord | null;
  identifiedTransactions: TransactionRecord[];
  pendingTransactions: TransactionRecord[];
  selectedClassifyTransaction: TransactionRecord | null;
};

export type SummaryGroup = {
  category: string;
  total: number;
  direction: string;
  proportion: number;
  scopeType: string;
  scopeMonth: string | null;
};

export type SummaryScopeRow = {
  scopeLabel: string;
  unresolvedCount: number;
  dateSpan: { start: string; end: string; label: string };
  groups: SummaryGroup[];
};

export function buildCategoryRuleMap(rules: RuleRecord[]) {
  const grouped: Record<string, string[]> = {};
  for (const rule of rules) {
    if (!rule.is_enabled) continue;
    if (!grouped[rule.category]) grouped[rule.category] = [];
    grouped[rule.category].push(rule.keyword);
  }
  return grouped;
}

export function deriveAvailableMonths(transactions: TransactionRecord[]) {
  return Array.from(
    new Set(transactions.map((item) => monthKey(item.date)).filter((item) => item !== "Unknown"))
  );
}

export function deriveAvailableDateRange(transactions: TransactionRecord[]) {
  const normalizedDates = transactions
    .map((item) => normalizeDateValue(item.date))
    .filter((item): item is string => item !== null)
    .sort();
  return {
    start: normalizedDates[0] || "",
    end: normalizedDates[normalizedDates.length - 1] || ""
  };
}

export function buildClassificationModel(input: {
  transactions: TransactionRecord[];
  selectedStatementId: string;
  selectedReviewTransactionId: string;
  selectedClassifyTransactionId: string;
}) {
  const {
    transactions,
    selectedStatementId,
    selectedReviewTransactionId,
    selectedClassifyTransactionId
  } = input;

  const selectedTransactions = sortTransactionsByDate(
    !selectedStatementId
      ? []
      : transactions.filter((item) => item.statement_id === selectedStatementId)
  );
  const selectedReviewTransaction =
    selectedTransactions.find((item) => item.id === selectedReviewTransactionId) ||
    selectedTransactions[0] ||
    null;
  const identifiedTransactions = selectedTransactions.filter((item) => item.status === "reviewed");
  const pendingTransactions = selectedTransactions.filter((item) => item.status !== "reviewed");
  const selectedClassifyTransaction =
    pendingTransactions.find((item) => item.id === selectedClassifyTransactionId) ||
    pendingTransactions[0] ||
    null;

  return {
    selectedTransactions,
    selectedReviewTransaction,
    identifiedTransactions,
    pendingTransactions,
    selectedClassifyTransaction
  } satisfies ClassificationModel;
}

export function buildSummaryModel(input: {
  mode: SummaryMode;
  selectedMonth: string;
  rangeStart: string;
  rangeEnd: string;
  confirmedTransactions: TransactionRecord[];
  allTransactions: TransactionRecord[];
  categories: { expense: string[]; income: string[] };
}) {
  const {
    mode,
    selectedMonth,
    rangeStart,
    rangeEnd,
    confirmedTransactions,
    allTransactions,
    categories
  } = input;

  const monthlyTransactions =
    selectedMonth === ""
      ? []
      : confirmedTransactions.filter((item) => monthKey(item.date) === selectedMonth);
  const customTransactions = filterTransactionsByRange(confirmedTransactions, rangeStart, rangeEnd);

  const scopes =
    mode === "monthly"
      ? selectedMonth === ""
        ? []
        : [{ key: selectedMonth, label: selectedMonth, transactions: monthlyTransactions }]
      : mode === "custom"
        ? [
            {
              key: rangeKey(rangeStart, rangeEnd),
              label: isValidRange(rangeStart, rangeEnd)
                ? rangeLabel(rangeStart, rangeEnd)
                : "Select a valid date range",
              transactions: customTransactions
            }
          ]
        : [{ key: "overall", label: "Overall", transactions: confirmedTransactions }];

  const rows: SummaryScopeRow[] = scopes.map((scope) => ({
    scopeLabel: scope.label,
    unresolvedCount:
      scope.transactions.length === 0
        ? 0
        : mode === "custom"
          ? filterTransactionsByRange(allTransactions, rangeStart, rangeEnd).filter((item) => item.status !== "reviewed").length
          : mode === "monthly"
            ? allTransactions.filter((item) => monthKey(item.date) === scope.key && item.status !== "reviewed").length
            : unresolvedCount(allTransactions),
    dateSpan: transactionDateSpan(scope.transactions),
    groups: categoryTotals(
      scope.transactions.filter((item) => item.debit_credit === "debit"),
      categories.expense
    )
      .map((row) => ({
        ...row,
        direction: "expense",
        proportion:
          totalByDirection(scope.transactions, "debit") === 0
            ? 0
            : row.total / totalByDirection(scope.transactions, "debit"),
        scopeType: mode === "monthly" ? "monthly" : mode === "custom" ? "custom" : "overall",
        scopeMonth: mode === "overall" ? null : scope.key
      }))
      .concat(
        categoryTotals(
          scope.transactions.filter((item) => item.debit_credit === "credit"),
          categories.income
        ).map((row) => ({
          ...row,
          direction: "income",
          proportion:
            totalByDirection(scope.transactions, "credit") === 0
              ? 0
              : row.total / totalByDirection(scope.transactions, "credit"),
          scopeType: mode === "monthly" ? "monthly" : mode === "custom" ? "custom" : "overall",
          scopeMonth: mode === "overall" ? null : scope.key
        }))
      )
  }));

  const activeTransactions =
    mode === "monthly"
      ? monthlyTransactions
      : mode === "custom"
        ? customTransactions
        : confirmedTransactions;

  const activeUnresolved =
    mode === "custom"
      ? filterTransactionsByRange(allTransactions, rangeStart, rangeEnd).filter((item) => item.status !== "reviewed").length
      : mode === "monthly"
        ? allTransactions.filter((item) => monthKey(item.date) === selectedMonth && item.status !== "reviewed").length
        : unresolvedCount(allTransactions);

  return {
    rows,
    activeTransactions,
    activeUnresolved,
    activeDateSpan: transactionDateSpan(activeTransactions)
  };
}
