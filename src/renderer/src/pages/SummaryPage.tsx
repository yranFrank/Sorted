import type { AdjustmentRecord } from "../types";
import type { SummaryMode, SummaryScopeRow } from "../workspace-selectors";

type SummaryPageProps = {
  summaryMode: SummaryMode;
  summaryMonth: string;
  availableMonths: string[];
  availableDateRange: { start: string; end: string };
  summaryDateStart: string;
  summaryDateEnd: string;
  workspaceStatementCount: number;
  activeSummaryTransactionsLength: number;
  activeSummaryExpense: string;
  activeSummaryIncome: string;
  activeSummaryUnresolved: number;
  activeSummaryDateSpanLabel: string;
  summaryRows: SummaryScopeRow[];
  busy: string;
  isValidRange: (start: string, end: string) => boolean;
  applySummaryRange: (start: string, end: string) => void;
  shiftIsoDate: (dateValue: string, days: number) => string;
  syncSummaryRangeToExport: () => void;
  setSummaryMode: (mode: SummaryMode) => void;
  setSummaryMonth: (month: string) => void;
  setSummaryDateStart: (value: string) => void;
  setSummaryDateEnd: (value: string) => void;
  adjustmentFor: (
    category: string,
    scopeType: string,
    scopeMonth: string | null
  ) => AdjustmentRecord | undefined;
  adjustmentKey: (category: string, scopeType: string, scopeMonth: string | null) => string;
  adjustmentDrafts: Record<string, { adjusted_total: string; note: string }>;
  setAdjustmentDraft: (
    category: string,
    scopeType: string,
    scopeMonth: string | null,
    field: "adjusted_total" | "note",
    value: string,
    originalTotal: number
  ) => void;
  saveAdjustment: (
    category: string,
    scopeType: string,
    scopeMonth: string | null,
    originalTotal: number
  ) => Promise<void>;
  money: (value: number) => string;
};

export function SummaryPage(props: SummaryPageProps) {
  const {
    summaryMode,
    summaryMonth,
    availableMonths,
    availableDateRange,
    summaryDateStart,
    summaryDateEnd,
    workspaceStatementCount,
    activeSummaryTransactionsLength,
    activeSummaryExpense,
    activeSummaryIncome,
    activeSummaryUnresolved,
    activeSummaryDateSpanLabel,
    summaryRows,
    busy,
    isValidRange,
    applySummaryRange,
    shiftIsoDate,
    syncSummaryRangeToExport,
    setSummaryMode,
    setSummaryMonth,
    setSummaryDateStart,
    setSummaryDateEnd,
    adjustmentFor,
    adjustmentKey,
    adjustmentDrafts,
    setAdjustmentDraft,
    saveAdjustment,
    money
  } = props;

  return (
    <section className="stack-gap">
      <div className="card page-banner">
        <div className="summary-topbar">
          <div className="summary-intro">
            <p className="eyebrow">Step 04</p>
            <h3>Summary</h3>
            <p className="muted">
              Switch between overall, monthly, and custom date-range views. Confirmed transactions only are included.
            </p>
          </div>
          <div className="summary-mode-row">
            <button className={summaryMode === "overall" ? "primary" : "ghost"} onClick={() => setSummaryMode("overall")}>
              Overall
            </button>
            <button className={summaryMode === "monthly" ? "primary" : "ghost"} onClick={() => setSummaryMode("monthly")}>
              Monthly
            </button>
            <button className={summaryMode === "custom" ? "primary" : "ghost"} onClick={() => setSummaryMode("custom")}>
              Date Range
            </button>
          </div>
        </div>

        {summaryMode === "custom" ? (
          <div className="summary-scope-panel">
            <div className="summary-quick-actions">
              <button
                className="ghost"
                disabled={availableDateRange.start === "" || availableDateRange.end === ""}
                onClick={() => applySummaryRange(availableDateRange.start, availableDateRange.end)}
              >
                Full Span
              </button>
              <button
                className="ghost"
                disabled={availableDateRange.end === ""}
                onClick={() => {
                  const end = availableDateRange.end;
                  applySummaryRange(shiftIsoDate(end, -29), end);
                }}
              >
                Last 30 Days
              </button>
              <button
                className="ghost"
                disabled={!isValidRange(summaryDateStart, summaryDateEnd)}
                onClick={syncSummaryRangeToExport}
              >
                Use In Export
              </button>
            </div>
            <div className="summary-control-grid">
              <label className="form-card">
                Start date
                <input type="date" value={summaryDateStart} onChange={(event) => setSummaryDateStart(event.target.value)} />
              </label>
              <label className="form-card">
                End date
                <input type="date" value={summaryDateEnd} onChange={(event) => setSummaryDateEnd(event.target.value)} />
              </label>
            </div>
          </div>
        ) : null}

        {summaryMode === "monthly" ? (
          <div className="summary-scope-panel">
            <div className="summary-control-grid">
              <label className="form-card">
                Summary month
                <select className="select-input" value={summaryMonth} onChange={(event) => setSummaryMonth(event.target.value)}>
                  <option value="">Select month</option>
                  {availableMonths.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : null}

        <div className="section-kicker">Financial Snapshot</div>
        <div className="stats-grid">
          <div className="card metric-card"><span>Statements</span><strong>{workspaceStatementCount}</strong></div>
          <div className="card metric-card"><span>Displayed txns</span><strong>{activeSummaryTransactionsLength}</strong></div>
          <div className="card metric-card"><span>Expense</span><strong>{activeSummaryExpense}</strong></div>
          <div className="card metric-card"><span>Income</span><strong>{activeSummaryIncome}</strong></div>
          <div className="card metric-card"><span>Unresolved</span><strong>{activeSummaryUnresolved}</strong></div>
        </div>
        <div className="detail-strip">
          <div className="detail-cell">
            <span>Scope range</span>
            <strong>{activeSummaryDateSpanLabel}</strong>
          </div>
          <div className="detail-cell">
            <span>View mode</span>
            <strong>{summaryMode === "monthly" ? (summaryMonth || "Select month") : summaryMode === "custom" ? "Date range" : "Overall"}</strong>
          </div>
          <div className="detail-cell">
            <span>Coverage</span>
            <strong>{summaryRows.length} scope{summaryRows.length === 1 ? "" : "s"}</strong>
          </div>
        </div>
      </div>

      {summaryMode === "monthly" && summaryMonth === "" ? (
        <div className="busy-banner">Choose a month to generate the monthly summary.</div>
      ) : null}
      {summaryMode === "custom" && !isValidRange(summaryDateStart, summaryDateEnd) ? (
        <div className="busy-banner">Choose a valid start and end date to generate a custom summary.</div>
      ) : null}

      {summaryRows.map((scope) => (
        <div key={scope.scopeLabel} className="card stack-gap">
          <div className="pane-head summary-scope-head">
            <div>
              <h3>{scope.scopeLabel}</h3>
              <p className="muted">{scope.dateSpan.label}</p>
            </div>
            <div className="summary-scope-badges">
              <span className="status-pill">
                {summaryMode === "monthly" ? "Monthly" : summaryMode === "custom" ? "Custom" : "Overall"}
              </span>
              <span className="status-pill">Unresolved {scope.unresolvedCount}</span>
            </div>
          </div>
          <div className="summary-grid">
            {scope.groups.map((group) => {
              const saved = adjustmentFor(group.category, group.scopeType, group.scopeMonth);
              const key = adjustmentKey(group.category, group.scopeType, group.scopeMonth);
              const adjustedValue =
                adjustmentDrafts[key]?.adjusted_total ?? String(saved?.adjusted_total ?? group.total);
              const noteValue = adjustmentDrafts[key]?.note ?? (saved?.note || "");

              return (
                <section key={key} className="card summary-pane">
                  <div className="pane-head">
                    <h3>{group.category}</h3>
                    <span className="status-pill">{group.direction}</span>
                  </div>
                  <div className="summary-row">
                    <span>Original total</span>
                    <strong>{money(group.total)}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Proportion</span>
                    <strong>{(group.proportion * 100).toFixed(1)}%</strong>
                  </div>
                  <label className="form-card">
                    Adjusted total
                    <input
                      value={adjustedValue}
                      onChange={(event) =>
                        setAdjustmentDraft(
                          group.category,
                          group.scopeType,
                          group.scopeMonth,
                          "adjusted_total",
                          event.target.value,
                          group.total
                        )
                      }
                    />
                  </label>
                  <label className="form-card">
                    Adjustment note
                    <input
                      value={noteValue}
                      onChange={(event) =>
                        setAdjustmentDraft(
                          group.category,
                          group.scopeType,
                          group.scopeMonth,
                          "note",
                          event.target.value,
                          group.total
                        )
                      }
                    />
                  </label>
                  <button
                    className="ghost"
                    disabled={busy !== ""}
                    onClick={() => void saveAdjustment(group.category, group.scopeType, group.scopeMonth, group.total)}
                  >
                    Save Adjustment
                  </button>
                </section>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
