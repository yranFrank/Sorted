import type { ReactNode } from "react";
import type { StatementRecord, TransactionRecord } from "../types";

type ClassificationPageProps = {
  selectedStatement?: StatementRecord;
  pendingTransactions: TransactionRecord[];
  identifiedTransactions: TransactionRecord[];
  focusTransaction: TransactionRecord | null;
  focusCategoryOptions: string[];
  focusRuleKeyword: string;
  workspaceRuleCount: number;
  newCategoryName: string;
  busy: string;
  applyRuleOnCategorySelect: boolean;
  ruleKeywordDrafts: Record<string, string>;
  categoryRuleMap: Record<string, string[]>;
  money: (value: number) => string;
  safeNumber: (value: unknown) => number;
  directionPill: (direction: string | null) => ReactNode;
  setPage: (page: "summary") => void;
  setSelectedClassifyTransactionId: (id: string) => void;
  setApplyRuleOnCategorySelect: (value: boolean) => void;
  setRuleKeywordDrafts: (
    updater: (previous: Record<string, string>) => Record<string, string>
  ) => void;
  setNewCategoryName: (value: string) => void;
  classifyTransaction: (
    transaction: TransactionRecord,
    category: string,
    options?: { applyRule?: boolean }
  ) => Promise<void>;
  saveTransactionUpdate: (transactionId: string, category: string, status: string) => Promise<void>;
  createRule: (transaction: TransactionRecord) => Promise<void>;
  searchTransactionOnGoogle: (transaction?: TransactionRecord | null) => Promise<void>;
  createCategory: (groupName: string) => Promise<void>;
};

export function ClassificationPage(props: ClassificationPageProps) {
  const {
    selectedStatement,
    pendingTransactions,
    identifiedTransactions,
    focusTransaction,
    focusCategoryOptions,
    focusRuleKeyword,
    workspaceRuleCount,
    newCategoryName,
    busy,
    applyRuleOnCategorySelect,
    ruleKeywordDrafts,
    categoryRuleMap,
    money,
    safeNumber,
    directionPill,
    setPage,
    setSelectedClassifyTransactionId,
    setApplyRuleOnCategorySelect,
    setRuleKeywordDrafts,
    setNewCategoryName,
    classifyTransaction,
    saveTransactionUpdate,
    createRule,
    searchTransactionOnGoogle,
    createCategory
  } = props;

  if (!selectedStatement) {
    return (
      <section className="card empty-state">
        <h3>Select a statement</h3>
        <p className="muted">Choose a statement before classification.</p>
      </section>
    );
  }

  return (
    <section className="stack-gap">
      <div className="card page-banner">
        <div className="row-wrap">
          <div>
            <p className="eyebrow">Step 03</p>
            <h3>Classification</h3>
            <p className="muted">Use the left queue, classify in the center, and keep the right archive for reference.</p>
          </div>
          <div className="action-inline">
            <button className="ghost" disabled={pendingTransactions.length === 0} onClick={() => setSelectedClassifyTransactionId(pendingTransactions[0]?.id || "")}>
              Open Next Pending
            </button>
            <button className="primary" disabled={pendingTransactions.length !== 0} onClick={() => setPage("summary")}>
              Continue to Summary
            </button>
          </div>
        </div>
        <div className="detail-strip">
          <div className="detail-cell">
            <span>Reviewed</span>
            <strong>{identifiedTransactions.length}</strong>
          </div>
          <div className="detail-cell">
            <span>Needs Review</span>
            <strong>{pendingTransactions.length}</strong>
          </div>
          <div className="detail-cell">
            <span>Rules</span>
            <strong>{workspaceRuleCount}</strong>
          </div>
        </div>
        {pendingTransactions.length !== 0 ? (
          <div className="busy-banner">Summary is gated until all transactions are resolved.</div>
        ) : null}
      </div>

      <div className="classification-workbench">
        <section className="card classification-column classification-column-pending">
          <div className="classification-column-head">
            <div>
              <div className="section-kicker">Needs Review</div>
              <h3>Pending Queue</h3>
            </div>
            <span className="status-pill">{pendingTransactions.length}</span>
          </div>
          <div className="classification-column-body">
            {pendingTransactions.length === 0 ? (
              <div className="empty-state subtle-empty">
                <p>No pending transactions.</p>
              </div>
            ) : (
              <div className="classification-ticket-list">
                {pendingTransactions.map((item) => (
                  <button
                    key={item.id}
                    className={
                      "classification-ticket" +
                      (item.id === focusTransaction?.id ? " classification-ticket-active" : "")
                    }
                    onClick={() => setSelectedClassifyTransactionId(item.id)}
                  >
                    <div className="classification-ticket-date">{item.date || "Unknown date"}</div>
                    <div className="classification-ticket-main">
                      <strong>{item.description}</strong>
                      <span>{money(safeNumber(item.amount))}</span>
                    </div>
                    <div className="classification-ticket-meta">
                      {directionPill(item.debit_credit)}
                      <span>{item.category || "Needs category"}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="card classification-column classification-column-focus">
          <div className="classification-column-head">
            <div>
              <div className="section-kicker">Assign Category</div>
              <h3>Resolution Desk</h3>
            </div>
            <span className="status-pill">{focusTransaction ? "Active" : "Idle"}</span>
          </div>
          <div className="classification-column-body classification-center-stack">
            {focusTransaction ? (
              <>
                <div className="classification-focus-card">
                  <span>Selected Transaction</span>
                  <strong>{focusTransaction.description}</strong>
                  <div className="classification-focus-meta">
                    <span>{focusTransaction.date}</span>
                    {directionPill(focusTransaction.debit_credit)}
                  </div>
                  <div className="classification-focus-amount">{money(safeNumber(focusTransaction.amount))}</div>
                </div>

                <div className="classification-action-grid">
                  {focusCategoryOptions.map((option) => (
                    <div key={option} className="classification-action-option">
                      <button
                        className={
                          "ghost classification-action-tile" +
                          (focusTransaction.category === option ? " classification-action-tile-active" : "")
                        }
                        onClick={() => void classifyTransaction(focusTransaction, option, { applyRule: applyRuleOnCategorySelect })}
                      >
                        {option}
                      </button>
                      <span className="classification-action-hint">
                        {categoryRuleMap[option]?.length
                          ? `(${categoryRuleMap[option].slice(0, 2).join(", ")})`
                          : "(no rule yet)"}
                      </span>
                    </div>
                  ))}
                  <div className="classification-action-option">
                    <button
                      className="ghost classification-action-tile"
                      onClick={() => void saveTransactionUpdate(focusTransaction.id, "Transfer", "reviewed")}
                    >
                      Transfer
                    </button>
                  </div>
                  <div className="classification-action-option">
                    <button
                      className="ghost classification-action-tile"
                      onClick={() => void saveTransactionUpdate(focusTransaction.id, "Ignored", "reviewed")}
                    >
                      Ignore
                    </button>
                  </div>
                </div>

                <label className="classification-rule-toggle">
                  <input
                    type="checkbox"
                    checked={applyRuleOnCategorySelect}
                    onChange={(event) => setApplyRuleOnCategorySelect(event.target.checked)}
                  />
                  <span>Apply rule to similar for this transaction</span>
                </label>
                {applyRuleOnCategorySelect ? (
                  <div className="classification-rule-banner">
                    This classification will also create a rule: {focusRuleKeyword || "No keyword available"}
                  </div>
                ) : null}

                <div className="classification-inline-tools">
                  <button
                    className="primary"
                    onClick={() =>
                      void classifyTransaction(
                        focusTransaction,
                        focusTransaction.category || focusCategoryOptions[0] || "Other (Raise concern)",
                        { applyRule: applyRuleOnCategorySelect }
                      )
                    }
                  >
                    Mark Reviewed
                  </button>
                  <button className="ghost" onClick={() => void searchTransactionOnGoogle(focusTransaction)}>
                    Search Merchant
                  </button>
                </div>

                <div className="classification-inline-tools">
                  <input
                    className="inline-input classification-inline-input"
                    placeholder="Keyword for rule"
                    value={ruleKeywordDrafts[focusTransaction.id] || ""}
                    onChange={(event) =>
                      setRuleKeywordDrafts((previous) => ({ ...previous, [focusTransaction.id]: event.target.value }))
                    }
                  />
                  <button
                    className="ghost"
                    disabled={(focusTransaction.category || "") === ""}
                    onClick={() => void createRule(focusTransaction)}
                  >
                    Create Rule From Current Category
                  </button>
                </div>
                <p className="muted">
                  Rule mode resets when you move to a different transaction, so each rule decision is explicit.
                </p>
              </>
            ) : (
              <div className="empty-state subtle-empty">
                <p>Everything is classified for this statement.</p>
              </div>
            )}

            <div className="classification-toolbox">
              <div className="section-kicker">Category Tools</div>
              <input
                className="inline-input classification-inline-input"
                placeholder="New category name"
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
              />
              <div className="classification-inline-tools">
                <button className="ghost" disabled={busy !== ""} onClick={() => void createCategory("expense")}>
                  Add Expense
                </button>
                <button className="ghost" disabled={busy !== ""} onClick={() => void createCategory("income")}>
                  Add Income
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="card classification-column classification-column-classified">
          <div className="classification-column-head">
            <div>
              <div className="section-kicker">Classified</div>
              <h3>Resolved Archive</h3>
            </div>
            <span className="status-pill">{identifiedTransactions.length}</span>
          </div>
          <div className="classification-column-body">
            {identifiedTransactions.length === 0 ? (
              <div className="empty-state subtle-empty">
                <p>No classified transactions yet.</p>
              </div>
            ) : (
              <div className="classification-ticket-list">
                {identifiedTransactions.map((item) => (
                  <article key={item.id} className="classification-ticket classification-ticket-complete">
                    <div className="classification-ticket-date">{item.date || "Unknown date"}</div>
                    <div className="classification-ticket-main">
                      <strong>{item.description}</strong>
                      <span>{money(safeNumber(item.amount))}</span>
                    </div>
                    <div className="classification-ticket-meta">
                      <span>{item.category || "Reviewed"}</span>
                      {directionPill(item.debit_credit)}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
