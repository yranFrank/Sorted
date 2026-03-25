import type { RuleRecord, TransactionRecord } from "./types";

export type SummaryMode = "overall" | "monthly" | "custom";

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

export function safeNumber(value: unknown) {
  return value === undefined || value === null || value === "" ? 0 : Number(value);
}

export function normalizeDateValue(dateValue: string | null | undefined) {
  if (!dateValue) return null;
  const isoMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return dateValue;
  const match = dateValue.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (!match) return null;
  const year = match[3].length === 2 ? "20" + match[3] : match[3];
  return `${year}-${match[2]}-${match[1]}`;
}

export function monthKey(dateValue: string | null) {
  if (!dateValue) return "Unknown";
  const match = dateValue.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (!match) return "Unknown";
  const year = match[3].length === 2 ? "20" + match[3] : match[3];
  return year + "-" + match[2];
}

export function rangeKey(start: string, end: string) {
  return `${start}..${end}`;
}

export function rangeLabel(start: string, end: string) {
  return `${start} to ${end}`;
}

export function isValidRange(start: string, end: string) {
  return start !== "" && end !== "" && start <= end;
}

export function filterTransactionsByRange(
  transactions: TransactionRecord[],
  start: string,
  end: string
) {
  if (!isValidRange(start, end)) return [];
  return transactions.filter((item) => {
    const normalized = normalizeDateValue(item.date);
    return normalized !== null && normalized >= start && normalized <= end;
  });
}

export function transactionDateSpan(transactions: TransactionRecord[]) {
  const normalizedDates = transactions
    .map((item) => normalizeDateValue(item.date))
    .filter((item): item is string => item !== null)
    .sort();

  if (normalizedDates.length === 0) {
    return { start: "", end: "", label: "No dated transactions" };
  }

  const start = normalizedDates[0];
  const end = normalizedDates[normalizedDates.length - 1];
  return {
    start,
    end,
    label: `${start} to ${end}`
  };
}

export function unresolvedCount(transactions: TransactionRecord[]) {
  return transactions.filter((item) => item.status !== "reviewed").length;
}

export function totalByDirection(transactions: TransactionRecord[], direction: string) {
  return transactions
    .filter((item) => item.debit_credit === direction)
    .reduce((sum, item) => sum + safeNumber(item.amount), 0);
}

export function categoryTotals(transactions: TransactionRecord[], categories: string[]) {
  return categories.map((category) => ({
    category,
    total: transactions
      .filter((item) => item.category === category)
      .reduce((sum, item) => sum + safeNumber(item.amount), 0)
  }));
}

export function sortTransactionsByDate(transactions: TransactionRecord[]) {
  return transactions.slice().sort((a, b) => {
    const aDate = normalizeDateValue(a.date) || "9999-99-99";
    const bDate = normalizeDateValue(b.date) || "9999-99-99";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return a.created_at.localeCompare(b.created_at);
  });
}

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
