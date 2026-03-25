export type ScopeMode = "overall" | "monthly" | "custom";

export type TransactionLike = {
  date: string | null;
  amount: number | null;
  debit_credit: string | null;
  status: string;
  category: string | null;
  created_at?: string;
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

export function isValidRange(start: string | null | undefined, end: string | null | undefined) {
  return !!start && !!end && start <= end;
}

export function filterTransactionsByRange<T extends TransactionLike>(
  transactions: T[],
  start: string,
  end: string
) {
  if (!isValidRange(start, end)) return [];
  return transactions.filter((item) => {
    const normalized = normalizeDateValue(item.date);
    return normalized !== null && normalized >= start && normalized <= end;
  });
}

export function transactionDateSpan<T extends TransactionLike>(transactions: T[]) {
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

export function unresolvedCount<T extends TransactionLike>(transactions: T[]) {
  return transactions.filter((item) => item.status !== "reviewed").length;
}

export function totalByDirection<T extends TransactionLike>(transactions: T[], direction: string) {
  return transactions
    .filter((item) => item.debit_credit === direction)
    .reduce((sum, item) => sum + safeNumber(item.amount), 0);
}

export function categoryTotals<T extends TransactionLike>(transactions: T[], categories: string[]) {
  return categories.map((category) => ({
    category,
    total: transactions
      .filter((item) => item.category === category)
      .reduce((sum, item) => sum + safeNumber(item.amount), 0)
  }));
}

export function compareTransactionDates<T extends TransactionLike>(a: T, b: T) {
  const aDate = normalizeDateValue(a.date) || "9999-99-99";
  const bDate = normalizeDateValue(b.date) || "9999-99-99";
  if (aDate !== bDate) return aDate.localeCompare(bDate);
  return String(a.created_at || "").localeCompare(String(b.created_at || ""));
}

export function sortTransactionsByDate<T extends TransactionLike>(transactions: T[]) {
  return transactions.slice().sort(compareTransactionDates);
}

export function filterTransactionsByScope<T extends TransactionLike>(input: {
  mode: ScopeMode;
  transactions: T[];
  selectedMonth: string | null | undefined;
  rangeStart: string | null | undefined;
  rangeEnd: string | null | undefined;
}) {
  const { mode, transactions, selectedMonth, rangeStart, rangeEnd } = input;
  if (mode === "monthly") {
    return !selectedMonth
      ? []
      : transactions.filter((item) => monthKey(item.date) === selectedMonth);
  }
  if (mode === "custom") {
    return !rangeStart || !rangeEnd ? [] : filterTransactionsByRange(transactions, rangeStart, rangeEnd);
  }
  return transactions;
}
