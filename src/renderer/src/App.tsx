import React, { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "./styles.css";
import { copy, type Language } from "./i18n";
import type {
  AdjustmentRecord,
  ExportHistoryRecord,
  ProjectPayload,
  ProjectRecord,
  RuleRecord,
  StatementRecord,
  TransactionRecord
} from "./types";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type WorkspaceData = {
  statements: StatementRecord[];
  transactions: TransactionRecord[];
  rules: RuleRecord[];
  categories: { expense: string[]; income: string[] };
  adjustments: AdjustmentRecord[];
  exportHistory: ExportHistoryRecord[];
};

type MetadataDraft = {
  bank_name: string;
  customer_name: string;
  account_name: string;
  account_number: string;
  bsb: string;
  statement_issue_date: string;
  statement_start_date: string;
  statement_end_date: string;
};

type Screen = "landing" | "history" | "new" | "workspace" | "rules";
type PageName = "import" | "review" | "classify" | "summary" | "export";

const emptyWorkspace: WorkspaceData = {
  statements: [],
  transactions: [],
  rules: [],
  categories: { expense: [], income: [] },
  adjustments: [],
  exportHistory: []
};

const workflowTabs: { key: PageName; label: string; number: string; blurb: string }[] = [
  { key: "import", label: "Import", number: "01", blurb: "Bring statements into the project." },
  { key: "review", label: "Parse", number: "02", blurb: "Verify extraction and fill metadata." },
  { key: "classify", label: "Classify", number: "03", blurb: "Resolve each transaction." },
  { key: "summary", label: "Summary", number: "04", blurb: "Check totals and adjustments." },
  { key: "export", label: "Export", number: "05", blurb: "Generate the workbook and track history." }
];

function money(value: number) {
  return "$" + value.toFixed(2);
}

function safeNumber(value: unknown) {
  return value === undefined || value === null || value === "" ? 0 : Number(value);
}

function parseStatusLabel(status: string) {
  if (status === "parsed") return "Parsed";
  if (status === "pending") return "Pending";
  return "Needs review";
}

function metadataStatusLabel(status: string) {
  if (status === "missing_required_fields") return "Metadata missing";
  if (status === "parsed_partial") return "Partially identified";
  return "Ready";
}

function splitRawText(rawText: string) {
  return rawText
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

function unresolvedCount(transactions: TransactionRecord[]) {
  return transactions.filter((item) => item.status !== "reviewed").length;
}

function totalByDirection(transactions: TransactionRecord[], direction: string) {
  return transactions
    .filter((item) => item.debit_credit === direction)
    .reduce((sum, item) => sum + safeNumber(item.amount), 0);
}

function categoryTotals(transactions: TransactionRecord[], categories: string[]) {
  return categories.map((category) => ({
    category,
    total: transactions
      .filter((item) => item.category === category)
      .reduce((sum, item) => sum + safeNumber(item.amount), 0)
  }));
}

function monthKey(dateValue: string | null) {
  if (!dateValue) return "Unknown";
  const match = dateValue.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (!match) return "Unknown";
  const year = match[3].length === 2 ? "20" + match[3] : match[3];
  return year + "-" + match[2];
}

function readMetadataDraft(statement?: StatementRecord, analysis?: any): MetadataDraft {
  return {
    bank_name: analysis?.bankName || statement?.bank_name || "",
    customer_name: statement?.customer_name || "",
    account_name: analysis?.accountName || statement?.account_name || "",
    account_number: analysis?.accountNumber || statement?.account_number || "",
    bsb: analysis?.bsb || statement?.bsb || "",
    statement_issue_date: statement?.statement_issue_date || "",
    statement_start_date: analysis?.statementStartDate || statement?.statement_start_date || "",
    statement_end_date: analysis?.statementEndDate || statement?.statement_end_date || ""
  };
}

function isMetadataComplete(draft: MetadataDraft) {
  return Object.values(draft).every((item) => item.trim() !== "");
}

function adjustmentKey(category: string, scopeType: string, scopeMonth: string | null) {
  return [category, scopeType, scopeMonth || ""].join("::");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function transactionNeedles(transaction?: TransactionRecord | null) {
  if (!transaction) return [];
  return [transaction.date || "", transaction.description || "", String(transaction.amount || "")]
    .map((item) => item.trim())
    .filter((item) => item.length >= 4);
}

function renderHighlightedText(text: string, needles: string[]) {
  if (needles.length === 0) return text;
  const pattern = needles.map((item) => escapeRegExp(item)).join("|");
  const regex = new RegExp("(" + pattern + ")", "gi");
  const parts = text.split(regex);
  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={String(index)} className="text-highlight">
        {part}
      </mark>
    ) : (
      <React.Fragment key={String(index)}>{part}</React.Fragment>
    )
  );
}

function PdfPreview({ filePath, maxPages = 2 }: { filePath: string; maxPages?: number }) {
  const [pageCount, setPageCount] = useState(0);
  return (
    <div className="pdf-preview-stack">
      <Document
        file={filePath}
        onLoadSuccess={({ numPages }) => setPageCount(numPages)}
        loading={
          <div className="empty-state subtle-empty">
            <p>Loading PDF preview...</p>
          </div>
        }
      >
        {Array.from({ length: Math.min(pageCount || 1, maxPages) }).map((_, index) => (
          <Page
            key={index + 1}
            pageNumber={index + 1}
            width={780}
            renderAnnotationLayer={false}
            renderTextLayer
          />
        ))}
      </Document>
      {pageCount > maxPages ? (
        <p className="muted">
          Showing the first {maxPages} pages in-app. Open review for the full statement context.
        </p>
      ) : null}
    </div>
  );
}

export default function App(): JSX.Element {
  const [language, setLanguage] = useState<Language>("zh");
  const [screen, setScreen] = useState<Screen>("landing");
  const [page, setPage] = useState<PageName>("import");
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [workspace, setWorkspace] = useState<WorkspaceData>(emptyWorkspace);
  const [draft, setDraft] = useState<ProjectPayload>({ customerName: "", projectName: "" });
  const [selectedId, setSelectedId] = useState("");
  const [analysisMap, setAnalysisMap] = useState<Record<string, any>>({});
  const [metadataDraft, setMetadataDraft] = useState<MetadataDraft>(readMetadataDraft());
  const [previewStatementId, setPreviewStatementId] = useState("");
  const [ruleKeywordDrafts, setRuleKeywordDrafts] = useState<Record<string, string>>({});
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedReviewTransactionId, setSelectedReviewTransactionId] = useState("");
  const [summaryMode, setSummaryMode] = useState("overall");
  const [exportMode, setExportMode] = useState("overall");
  const [exportMonth, setExportMonth] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [adjustmentDrafts, setAdjustmentDrafts] = useState<
    Record<string, { adjusted_total: string; note: string }>
  >({});
  const [busy, setBusy] = useState("");
  const [exportPath, setExportPath] = useState("");

  const t = copy[language];
  const activeProject = projects.find((item) => item.id === activeProjectId);
  const selectedStatement = workspace.statements.find((item) => item.id === selectedId);
  const previewStatement = workspace.statements.find((item) => item.id === previewStatementId);
  const selectedAnalysis = selectedId ? analysisMap[selectedId] : null;

  async function refreshProjects() {
    setProjects((await window.bankApp.listProjects()) as ProjectRecord[]);
  }

  async function loadWorkspace(projectId: string) {
    const data = (await window.bankApp.openProject(projectId)) as WorkspaceData;
    setWorkspace(data);
    setSelectedId(data.statements[0]?.id || "");
  }

  async function openProject(projectId: string, nextPage: PageName) {
    setBusy("Opening project...");
    setActiveProjectId(projectId);
    await loadWorkspace(projectId);
    setPage(nextPage);
    setScreen("workspace");
    setBusy("");
  }

  async function createProject() {
    if (draft.customerName.trim() === "" || draft.projectName.trim() === "") return;
    const created = (await window.bankApp.createProject(draft)) as ProjectRecord;
    setDraft({ customerName: "", projectName: "" });
    await refreshProjects();
    await openProject(created.id, "import");
  }

  async function importStatements() {
    if (!activeProject) return;
    const filePaths = (await window.bankApp.pickStatementFiles()) as string[];
    if (filePaths.length === 0) return;
    setBusy("Importing and parsing statements...");
    await window.bankApp.addStatements({ projectId: activeProject.id, filePaths });
    await loadWorkspace(activeProject.id);
    await refreshProjects();
    setPage("import");
    setBusy("");
  }

  async function openRules() {
    setBusy("Loading rules...");
    setRuleKeywordDrafts({});
    setScreen("rules");
    if (activeProjectId) await loadWorkspace(activeProjectId);
    setBusy("");
  }

  async function ensureAnalysis(statement?: StatementRecord) {
    if (!statement) return null;
    if (analysisMap[statement.id]) return analysisMap[statement.id];
    const analysis = await window.bankApp.analyzeStatementPreview(statement.file_path);
    setAnalysisMap((previous) => ({ ...previous, [statement.id]: analysis }));
    return analysis;
  }

  async function reparseSelected() {
    if (!selectedStatement) return;
    setBusy("Re-parsing selected statement...");
    await window.bankApp.parseAndStoreStatement({
      statementId: selectedStatement.id,
      filePath: selectedStatement.file_path
    });
    const analysis = await window.bankApp.analyzeStatementPreview(selectedStatement.file_path);
    setAnalysisMap((previous) => ({ ...previous, [selectedStatement.id]: analysis }));
    await loadWorkspace(activeProjectId);
    await refreshProjects();
    setBusy("");
  }

  async function saveMetadata() {
    if (!selectedStatement) return false;
    setBusy("Saving metadata...");
    await window.bankApp.updateStatementMetadata({
      statementId: selectedStatement.id,
      ...metadataDraft
    });
    await loadWorkspace(activeProjectId);
    await refreshProjects();
    setBusy("");
    return true;
  }

  async function continueToClassification() {
    if (!isMetadataComplete(metadataDraft)) return;
    const saved = await saveMetadata();
    if (saved) setPage("classify");
  }

  async function saveTransactionUpdate(transactionId: string, category: string, status: string) {
    if (!selectedStatement) return;
    setBusy("Saving transaction classification...");
    await window.bankApp.updateTransactionClassifications({
      statementId: selectedStatement.id,
      updates: [{ id: transactionId, category, status }]
    });
    await loadWorkspace(activeProjectId);
    await refreshProjects();
    setBusy("");
  }

  async function createCategory(groupName: string) {
    if (newCategoryName.trim() === "") return;
    setBusy("Creating category...");
    await window.bankApp.createCategory({ name: newCategoryName, group_name: groupName });
    await loadWorkspace(activeProjectId);
    setNewCategoryName("");
    setBusy("");
  }

  async function createRule(transaction: TransactionRecord) {
    const keyword = (ruleKeywordDrafts[transaction.id] || "").trim();
    if (keyword === "") return;
    setBusy("Saving keyword rule...");
    await window.bankApp.createRule({
      keyword,
      category: transaction.category || "",
      match_type: "keyword",
      priority: 100
    });
    await loadWorkspace(activeProjectId);
    setRuleKeywordDrafts((previous) => ({ ...previous, [transaction.id]: "" }));
    setBusy("");
  }

  async function updateRuleRecord(rule: RuleRecord, patch: Partial<RuleRecord>) {
    setBusy("Updating rule...");
    await window.bankApp.updateRule({
      id: rule.id,
      keyword: patch.keyword || rule.keyword,
      category: patch.category || rule.category,
      is_enabled: patch.is_enabled ?? rule.is_enabled
    });
    await loadWorkspace(activeProjectId);
    setBusy("");
  }

  async function deleteRuleRecord(ruleId: string) {
    setBusy("Deleting rule...");
    await window.bankApp.deleteRule(ruleId);
    await loadWorkspace(activeProjectId);
    setBusy("");
  }

  async function saveAdjustment(
    category: string,
    scopeType: string,
    scopeMonth: string | null,
    originalTotal: number
  ) {
    if (!activeProject) return;
    const key = adjustmentKey(category, scopeType, scopeMonth);
    const draftValue = adjustmentDrafts[key] || {
      adjusted_total: String(originalTotal),
      note: ""
    };
    setBusy("Saving adjustment...");
    await window.bankApp.upsertAdjustment({
      project_id: activeProject.id,
      category,
      scope_type: scopeType,
      scope_month: scopeMonth,
      original_total: originalTotal,
      adjusted_total: Number(draftValue.adjusted_total || originalTotal),
      note: draftValue.note
    });
    await loadWorkspace(activeProjectId);
    setBusy("");
  }

  async function exportWorkbook() {
    if (!activeProject) return;
    setBusy("Exporting workbook...");
    const month = exportMode === "monthly" ? exportMonth || null : null;
    const result = (await window.bankApp.exportLivingExpense({
      projectId: activeProject.id,
      exportType: exportMode,
      exportMonth: month,
      versionLabel: versionLabel.trim() || null
    })) as any;
    setExportPath(result.filePath);
    await loadWorkspace(activeProject.id);
    await refreshProjects();
    setBusy("");
  }

  useEffect(() => {
    void refreshProjects();
  }, []);

  useEffect(() => {
    if (screen !== "workspace" || !selectedStatement) return;
    void ensureAnalysis(selectedStatement);
  }, [screen, selectedStatement]);

  useEffect(() => {
    setMetadataDraft(readMetadataDraft(selectedStatement, selectedAnalysis));
  }, [selectedStatement, selectedAnalysis]);

  useEffect(() => {
    setSelectedReviewTransactionId("");
  }, [selectedId]);

  const selectedTransactions = useMemo(
    () => (!selectedId ? [] : workspace.transactions.filter((item) => item.statement_id === selectedId)),
    [workspace.transactions, selectedId]
  );
  const selectedReviewTransaction =
    selectedTransactions.find((item) => item.id === selectedReviewTransactionId) ||
    selectedTransactions[0] ||
    null;
  const identifiedTransactions = selectedTransactions.filter((item) => item.status === "reviewed");
  const pendingTransactions = selectedTransactions.filter((item) => item.status !== "reviewed");
  const confirmedTransactions = workspace.transactions.filter((item) => item.status === "reviewed");
  const availableMonths = Array.from(
    new Set(confirmedTransactions.map((item) => monthKey(item.date)).filter((item) => item !== "Unknown"))
  );
  const summaryScopes = useMemo(
    () =>
      summaryMode === "monthly"
        ? availableMonths.map((month) => ({
            key: month,
            label: month,
            transactions: confirmedTransactions.filter((item) => monthKey(item.date) === month)
          }))
        : [{ key: "overall", label: "Overall", transactions: confirmedTransactions }],
    [summaryMode, availableMonths, confirmedTransactions]
  );
  const summaryRows = useMemo(
    () =>
      summaryScopes.map((scope) => ({
        scopeLabel: scope.label,
        groups: categoryTotals(
          scope.transactions.filter((item) => item.debit_credit === "debit"),
          workspace.categories.expense
        )
          .map((row) => ({
            ...row,
            direction: "expense",
            scopeType: summaryMode === "monthly" ? "monthly" : "overall",
            scopeMonth: summaryMode === "monthly" ? scope.key : null
          }))
          .concat(
            categoryTotals(
              scope.transactions.filter((item) => item.debit_credit === "credit"),
              workspace.categories.income
            ).map((row) => ({
              ...row,
              direction: "income",
              scopeType: summaryMode === "monthly" ? "monthly" : "overall",
              scopeMonth: summaryMode === "monthly" ? scope.key : null
            }))
          )
      })),
    [summaryScopes, workspace.categories, summaryMode]
  );
  const selectedNeedles = transactionNeedles(selectedReviewTransaction);

  function adjustmentFor(category: string, scopeType: string, scopeMonth: string | null) {
    return workspace.adjustments.find(
      (item) =>
        item.category === category &&
        item.scope_type === scopeType &&
        (item.scope_month || "") === (scopeMonth || "")
    );
  }

  function setAdjustmentDraft(
    category: string,
    scopeType: string,
    scopeMonth: string | null,
    field: "adjusted_total" | "note",
    value: string,
    originalTotal: number
  ) {
    const key = adjustmentKey(category, scopeType, scopeMonth);
    setAdjustmentDrafts((previous) => ({
      ...previous,
      [key]: {
        adjusted_total: String(originalTotal),
        note: "",
        ...(previous[key] || {}),
        [field]: value
      }
    }));
  }

  function toggleLanguage() {
    setLanguage(language === "zh" ? "en" : "zh");
  }

  function topBar(title: string, subtitle: string, actions?: React.ReactNode) {
    return (
      <div className="page-top editorial-topbar">
        <div className="page-intro">
          <p className="eyebrow">Baseline V2.1</p>
          <h1>{title}</h1>
          <p className="muted lead">{subtitle}</p>
        </div>
        <div className="page-top-actions">{actions}</div>
      </div>
    );
  }

  function sidebar() {
    const systemItems = [
      { key: "landing", number: "00", label: "Overview", active: screen === "landing", onClick: () => setScreen("landing") },
      { key: "new", number: "01", label: "Start New", active: screen === "new", onClick: () => setScreen("new") },
      { key: "history", number: "02", label: "History", active: screen === "history", onClick: () => setScreen("history") },
      { key: "rules", number: "03", label: "Rules", active: screen === "rules", onClick: () => void openRules() }
    ];

    return (
      <aside className="editorial-sidebar">
        <div className="sidebar-masthead">
          <button className="masthead-link" onClick={() => setScreen("landing")}>
            <span className="masthead-kicker">Est. 2026</span>
            <strong>Sorted</strong>
            <span className="masthead-subtitle">Local Statement Workflow</span>
          </button>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-label">System</p>
          <div className="sidebar-nav">
            {systemItems.map((item) => (
              <button
                key={item.key}
                className={item.active ? "sidebar-link sidebar-link-active" : "sidebar-link"}
                onClick={item.onClick}
              >
                <span className="sidebar-number">{item.number}</span>
                <span className="sidebar-copy">
                  <strong>{item.label}</strong>
                </span>
              </button>
            ))}
          </div>
        </div>

        {activeProject ? (
          <div className="sidebar-section sidebar-section-grow">
            <p className="sidebar-label">Workflow</p>
            <div className="sidebar-nav">
              {workflowTabs.map((tab) => (
                <button
                  key={tab.key}
                  className={
                    screen === "workspace" && page === tab.key
                      ? "sidebar-link sidebar-link-active"
                      : "sidebar-link"
                  }
                  onClick={() => {
                    setScreen("workspace");
                    setPage(tab.key);
                  }}
                >
                  <span className="sidebar-number">{tab.number}</span>
                  <span className="sidebar-copy">
                    <strong>{tab.label}</strong>
                    <small>{tab.blurb}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="sidebar-section sidebar-section-grow">
            <p className="sidebar-label">Mode</p>
            <div className="sidebar-note">
              <strong>Offline-first desktop</strong>
              <p>Import bank statements, review extracted transactions, classify, adjust, and export.</p>
            </div>
          </div>
        )}

        <div className="sidebar-footer">
          <div className="sidebar-badge">{language === "zh" ? "ZH" : "EN"}</div>
          <div className="sidebar-footer-copy">
            <strong>{activeProject ? activeProject.project_name : "Ready for intake"}</strong>
            <span>{activeProject ? activeProject.customer_name : "Select or create a project"}</span>
          </div>
        </div>
      </aside>
    );
  }

  function appShell(title: string, subtitle: string, body: React.ReactNode, actions?: React.ReactNode) {
    return (
      <div className="editorial-app">
        {sidebar()}
        <main className="editorial-main">
          <div className="editorial-rule" />
          <div className="editorial-scroll">
            <div className="page-width stack-gap">
              {topBar(title, subtitle, actions)}
              {busy === "" ? null : <div className="busy-banner">{busy}</div>}
              {body}
            </div>
          </div>
          {previewModal()}
        </main>
      </div>
    );
  }

  function previewModal() {
    if (!previewStatement) return null;
    return (
      <div className="modal-shell" onClick={() => setPreviewStatementId("")}>
        <div className="modal-card" onClick={(event) => event.stopPropagation()}>
          <div className="row-wrap">
            <div>
              <h3>{previewStatement.file_name}</h3>
              <p className="muted">Preview the original statement before review.</p>
            </div>
            <div className="action-inline">
              <button className="ghost" onClick={() => setPreviewStatementId("")}>
                Close
              </button>
              <button
                className="primary"
                onClick={() => {
                  setSelectedId(previewStatement.id);
                  setPage("review");
                  setScreen("workspace");
                  setPreviewStatementId("");
                }}
              >
                Open in Review
              </button>
            </div>
          </div>
          <PdfPreview filePath={previewStatement.file_path} maxPages={3} />
        </div>
      </div>
    );
  }

  function landingView() {
    return appShell(
      t.appTitle,
      t.subtitle,
      <>
        <section className="landing-masthead card">
          <div className="masthead-strip">
            <span>Est. 2026</span>
            <span>Local Edition</span>
            <span>Offline Desktop Workflow</span>
          </div>
          <div className="landing-title">
            <h2>Sorted</h2>
            <p>Professional bank statement analysis · local processing only</p>
          </div>
        </section>
        <section className="hero-grid">
          <div className="hero-panel card">
            <p className="eyebrow">Lead Feature</p>
            <h2>Analyze Statements With Precision And Speed.</h2>
            <p className="lead muted">
              The interface now follows your editorial newspaper direction while preserving the baseline
              workflow for import, parse review, classification, summary adjustments, and export tracking.
            </p>
            <div className="hero-actions">
              <button className="primary" onClick={() => setScreen("new")}>
                Start New File
              </button>
              <button className="ghost" onClick={() => setScreen("history")}>
                Open History
              </button>
              <button className="ghost" onClick={() => void openRules()}>
                Review Rules
              </button>
            </div>
          </div>
          <div className="hero-side">
            <div className="security-panel">
              <p className="eyebrow">Security First</p>
              <strong>100% Local & Secure</strong>
              <p>No client statement data leaves the machine. Review, classify, and export fully offline.</p>
            </div>
            <div className="mini-feature-grid">
              <div className="mini-feature">
                <span>Rules</span>
                <strong>Auto Classify</strong>
                <p>Keyword rules engine</p>
              </div>
              <div className="mini-feature">
                <span>Merge</span>
                <strong>Multi-Account</strong>
                <p>Consolidate any bank</p>
              </div>
            </div>
            <div className="metric-strip">
              <div className="metric-tile">
                <span>Projects</span>
                <strong>{projects.length}</strong>
              </div>
              <div className="metric-tile">
                <span>Mode</span>
                <strong>Offline</strong>
              </div>
              <div className="metric-tile">
                <span>Baseline</span>
                <strong>V2.1</strong>
              </div>
            </div>
          </div>
        </section>
      </>,
      <button className="ghost language-switch" onClick={toggleLanguage}>
        {language === "zh" ? "EN" : "ZH"}
      </button>
    );
  }

  function historyView() {
    return appShell(
      "History Cases",
      "Open an existing project and jump back into the workflow.",
      <section className="project-list">
        {projects.length === 0 ? (
          <div className="card empty-state">
            <h3>{t.noProjects}</h3>
            <p className="muted">Create a project first.</p>
          </div>
        ) : (
          projects.map((project) => (
            <button
              key={project.id}
              className="project-card"
              onClick={() => void openProject(project.id, "import")}
            >
              <div className="project-card-top">
                <div>
                  <p className="eyebrow">Case File</p>
                  <h3>{project.project_name}</h3>
                </div>
                <span className="status-pill">{project.statement_count} statements</span>
              </div>
              <p className="muted">{project.customer_name}</p>
              <div className="project-card-meta">
                <span>Unresolved {project.unresolved_count}</span>
                <span>Status {project.status}</span>
              </div>
            </button>
          ))
        )}
      </section>,
      <div className="page-top-actions">
        <button className="ghost" onClick={() => setScreen("new")}>
          New Project
        </button>
        <button className="ghost language-switch" onClick={toggleLanguage}>
          {language === "zh" ? "EN" : "ZH"}
        </button>
      </div>
    );
  }

  function newView() {
    return appShell(
      "Start New File",
      "Create the project before importing statements.",
      <section className="card form-card intake-card">
        <div className="form-intro">
          <p className="eyebrow">New Intake</p>
          <h3>{t.start}</h3>
        </div>
        <label className="input-field">
          <span>{t.customerName}</span>
          <input
            value={draft.customerName}
            onChange={(event) =>
              setDraft({ customerName: event.target.value, projectName: draft.projectName })
            }
          />
        </label>
        <label className="input-field">
          <span>{t.projectName}</span>
          <input
            value={draft.projectName}
            onChange={(event) =>
              setDraft({ customerName: draft.customerName, projectName: event.target.value })
            }
          />
        </label>
        <button className="primary" disabled={busy !== ""} onClick={() => void createProject()}>
          Create and Continue
        </button>
      </section>,
      <div className="page-top-actions">
        <button className="ghost" onClick={() => setScreen("history")}>
          Open Existing
        </button>
        <button className="ghost language-switch" onClick={toggleLanguage}>
          {language === "zh" ? "EN" : "ZH"}
        </button>
      </div>
    );
  }

  function workspaceHeader() {
    return (
      <section className="workspace-header card">
        <div className="workspace-title-row">
          <div>
            <p className="eyebrow">Current Project</p>
            <h2>{activeProject ? activeProject.project_name : t.appTitle}</h2>
            <p className="muted">{activeProject ? activeProject.customer_name : ""}</p>
          </div>
          <div className="workspace-actions">
            <button className="ghost" onClick={() => setScreen("history")}>
              Switch Project
            </button>
            <button className="ghost language-switch" onClick={toggleLanguage}>
              {language === "zh" ? "EN" : "ZH"}
            </button>
          </div>
        </div>
        <div className="tab-row">
          {workflowTabs.map((tab) => (
            <button
              key={tab.key}
              className={page === tab.key ? "tab-button tab-active" : "tab-button"}
              onClick={() => setPage(tab.key)}
            >
              <span>{tab.number}</span>
              <strong>{tab.label}</strong>
            </button>
          ))}
        </div>
      </section>
    );
  }

  function importView() {
    return (
      <section className="stack-gap">
        <div className="card page-banner">
          <div className="row-wrap">
            <div>
              <p className="eyebrow">Step 01</p>
              <h3>Import Statements</h3>
              <p className="muted">Cards open a preview modal first, matching the baseline review flow.</p>
            </div>
            <div className="action-inline">
              <div className="micro-stat">
                <span>Staged Files</span>
                <strong>{workspace.statements.length}</strong>
              </div>
              <button className="primary" disabled={busy !== ""} onClick={() => void importStatements()}>
                {t.pickPdf}
              </button>
            </div>
          </div>
        </div>
        <div className="statement-grid">
          {workspace.statements.length === 0 ? (
            <div className="card empty-state">
              <h3>No statements imported</h3>
              <p className="muted">Import PDF files first.</p>
            </div>
          ) : (
            workspace.statements.map((statement) => (
              <button
                key={statement.id}
                className={selectedId === statement.id ? "statement-card statement-selected" : "statement-card"}
                onClick={() => setPreviewStatementId(statement.id)}
              >
                <div className="statement-top">
                  <div>
                    <p className="eyebrow">Statement</p>
                    <h3>{statement.file_name}</h3>
                  </div>
                  <span className="status-pill">{parseStatusLabel(statement.parse_status)}</span>
                </div>
                <div className="statement-meta">
                  <span>{statement.bank_name || "Bank pending"}</span>
                  <span>
                    {statement.statement_start_date && statement.statement_end_date
                      ? statement.statement_start_date + " - " + statement.statement_end_date
                      : "Period pending"}
                  </span>
                </div>
                <div className="statement-meta">
                  <span>{metadataStatusLabel(statement.metadata_status)}</span>
                  <span>
                    Unresolved{" "}
                    {
                      workspace.transactions.filter(
                        (item) => item.statement_id === statement.id && item.status !== "reviewed"
                      ).length
                    }
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>
    );
  }

  function reviewView() {
    if (!selectedStatement) {
      return (
        <section className="card empty-state">
          <h3>Select a statement</h3>
          <p className="muted">Choose a statement from import.</p>
        </section>
      );
    }

    return (
      <section className="stack-gap">
        <div className="card page-banner">
          <div className="row-wrap">
            <div>
              <p className="eyebrow">Step 02</p>
              <h3>Parse / Review</h3>
              <p className="muted">Complete mandatory metadata before the project can move forward.</p>
            </div>
            <div className="action-inline">
              <button className="ghost" disabled={busy !== ""} onClick={() => void reparseSelected()}>
                Re-parse Selected
              </button>
              <button className="ghost" disabled={busy !== ""} onClick={() => void saveMetadata()}>
                Save Metadata
              </button>
              <button
                className="primary"
                disabled={busy !== "" || !isMetadataComplete(metadataDraft)}
                onClick={() => void continueToClassification()}
              >
                Continue to Classification
              </button>
            </div>
          </div>
          <div className="detail-strip">
            <div className="detail-cell">
              <span>Statement</span>
              <strong>{selectedStatement.file_name}</strong>
            </div>
            <div className="detail-cell">
              <span>Status</span>
              <strong>{parseStatusLabel(selectedStatement.parse_status)}</strong>
            </div>
            <div className="detail-cell">
              <span>Transactions</span>
              <strong>{selectedTransactions.length}</strong>
            </div>
          </div>
          {!isMetadataComplete(metadataDraft) ? (
            <div className="busy-banner">Complete all required metadata fields before continuing.</div>
          ) : null}
          <div className="metadata-grid">
            {[
              ["bank_name", "Bank"],
              ["customer_name", "Customer"],
              ["account_name", "Account"],
              ["account_number", "Account No."],
              ["bsb", "BSB"],
              ["statement_issue_date", "Issue Date"],
              ["statement_start_date", "Start Date"],
              ["statement_end_date", "End Date"]
            ].map(([field, label]) => (
              <label key={field} className="meta-box meta-field">
                <span>{label}</span>
                <input
                  value={metadataDraft[field as keyof MetadataDraft]}
                  onChange={(event) =>
                    setMetadataDraft((previous) => ({ ...previous, [field]: event.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        </div>

        {selectedReviewTransaction ? (
          <div className="card selection-banner">
            <strong>Selected transaction</strong>
            <span>
              {selectedReviewTransaction.date} {selectedReviewTransaction.description}
            </span>
            <span>{money(safeNumber(selectedReviewTransaction.amount))}</span>
          </div>
        ) : null}

        <div className="review-grid">
          <section className="card review-pane">
            <div className="pane-head">
              <h3>Original File Preview</h3>
              <span className="status-pill">{selectedAnalysis ? selectedAnalysis.pages + " pages" : ""}</span>
            </div>
            <PdfPreview filePath={selectedStatement.file_path} maxPages={2} />
            <div className="raw-list">
              {splitRawText(selectedAnalysis?.rawText || "").map((block, index) => {
                const hasMatch = selectedNeedles.some((needle) =>
                  block.toLowerCase().includes(needle.toLowerCase())
                );
                return (
                  <article key={String(index)} className={hasMatch ? "raw-card raw-card-hit" : "raw-card"}>
                    <div className="raw-card-head">
                      <strong>Block {index + 1}</strong>
                      {hasMatch ? <span className="status-pill">Matched</span> : null}
                    </div>
                    <p className="raw-card-text">{renderHighlightedText(block, selectedNeedles)}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="card review-pane">
            <div className="pane-head">
              <h3>Extracted Transactions</h3>
              <span className="status-pill">{selectedTransactions.length}</span>
            </div>
            <div className="section-kicker">Parsed Rows</div>
            <div className="transaction-list">
              {selectedTransactions.length === 0 ? (
                <div className="empty-state subtle-empty">
                  <p>No extracted transactions available.</p>
                </div>
              ) : (
                selectedTransactions.map((item) => (
                  <article
                    key={item.id}
                    className={
                      item.id === selectedReviewTransaction?.id
                        ? "transaction-card transaction-card-selected"
                        : "transaction-card"
                    }
                    onClick={() => setSelectedReviewTransactionId(item.id)}
                  >
                    <div className="transaction-top">
                      <strong>{item.date}</strong>
                      <span className="amount-chip">{money(safeNumber(item.amount))}</span>
                    </div>
                    <p className="transaction-description">{item.description}</p>
                    <div className="transaction-meta">
                      <span>{item.category || "Needs category"}</span>
                      <span>{item.debit_credit}</span>
                      <span>Status {item.status}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    );
  }

  function classifyView() {
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
              <p className="muted">
                Every unresolved transaction must be reviewed, transferred, ignored, or assigned a category.
              </p>
            </div>
            <div className="action-inline">
              <input
                className="inline-input"
                placeholder="New category name"
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
              />
              <button className="ghost" disabled={busy !== ""} onClick={() => void createCategory("expense")}>
                Add Expense Category
              </button>
              <button className="ghost" disabled={busy !== ""} onClick={() => void createCategory("income")}>
                Add Income Category
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
              <strong>{workspace.rules.length}</strong>
            </div>
          </div>
          {pendingTransactions.length !== 0 ? (
            <div className="busy-banner">Summary is gated until all transactions are resolved.</div>
          ) : null}
        </div>

        <div className="classification-grid">
          <section className="card classify-pane">
            <div className="pane-head">
              <h3>Source List</h3>
              <span className="status-pill">{selectedTransactions.length}</span>
            </div>
            <div className="classify-list">
              {selectedTransactions.map((item) => (
                <article key={item.id} className="classification-item">
                  <strong>{item.description}</strong>
                  <div className="classification-meta">
                    <span>{item.date}</span>
                    <span>{money(safeNumber(item.amount))}</span>
                    <span>{item.debit_credit}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="card classify-pane">
            <div className="pane-head">
              <h3>Identified</h3>
              <span className="status-pill">{identifiedTransactions.length}</span>
            </div>
            <div className="classify-list">
              {identifiedTransactions.length === 0 ? (
                <div className="empty-state subtle-empty">
                  <p>No identified transactions yet.</p>
                </div>
              ) : (
                identifiedTransactions.map((item) => (
                  <article key={item.id} className="classification-item classification-good">
                    <strong>{item.description}</strong>
                    <div className="classification-meta">
                      <span>{item.category}</span>
                      <span>{money(safeNumber(item.amount))}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="card classify-pane">
            <div className="pane-head">
              <h3>Needs Review</h3>
              <span className="status-pill">{pendingTransactions.length}</span>
            </div>
            <div className="section-kicker">Manual Resolution Desk</div>
            <div className="classify-list">
              {pendingTransactions.length === 0 ? (
                <div className="empty-state subtle-empty">
                  <p>No pending transactions.</p>
                </div>
              ) : (
                pendingTransactions.map((item) => (
                  <article key={item.id} className="classification-item classification-alert">
                    <strong>{item.description}</strong>
                    <div className="classification-meta">
                      <span>{item.category || "Needs category"}</span>
                      <span>{money(safeNumber(item.amount))}</span>
                    </div>
                    <div className="classification-actions">
                      <select
                        className="select-input"
                        value={item.category || ""}
                        onChange={(event) => void saveTransactionUpdate(item.id, event.target.value, item.status)}
                      >
                        <option value="">Select category</option>
                        {(item.debit_credit === "credit"
                          ? workspace.categories.income
                          : workspace.categories.expense
                        ).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <button
                        className="ghost"
                        onClick={() =>
                          void saveTransactionUpdate(
                            item.id,
                            item.category ||
                              ((item.debit_credit === "credit"
                                ? workspace.categories.income[0]
                                : workspace.categories.expense[0]) || "Other (Raise concern)"),
                            "reviewed"
                          )
                        }
                      >
                        Mark Reviewed
                      </button>
                      <button className="ghost" onClick={() => void saveTransactionUpdate(item.id, "Transfer", "reviewed")}>
                        Mark Transfer
                      </button>
                      <button className="ghost" onClick={() => void saveTransactionUpdate(item.id, "Ignored", "reviewed")}>
                        Ignore
                      </button>
                    </div>
                    <div className="classification-actions">
                      <input
                        className="inline-input"
                        placeholder="Keyword for rule"
                        value={ruleKeywordDrafts[item.id] || ""}
                        onChange={(event) =>
                          setRuleKeywordDrafts((previous) => ({ ...previous, [item.id]: event.target.value }))
                        }
                      />
                      <button className="ghost" onClick={() => void createRule(item)}>
                        Apply Rule to Similar
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    );
  }

  function summaryView() {
    return (
      <section className="stack-gap">
        <div className="card page-banner">
          <div className="row-wrap">
            <div>
              <p className="eyebrow">Step 04</p>
              <h3>Summary</h3>
              <p className="muted">
                Switch between overall and monthly views. Confirmed transactions only are included.
              </p>
            </div>
            <div className="action-inline">
              <button className={summaryMode === "overall" ? "primary" : "ghost"} onClick={() => setSummaryMode("overall")}>
                Overall
              </button>
              <button className={summaryMode === "monthly" ? "primary" : "ghost"} onClick={() => setSummaryMode("monthly")}>
                Monthly
              </button>
            </div>
          </div>
          <div className="section-kicker">Financial Snapshot</div>
          <div className="stats-grid">
            <div className="card metric-card"><span>Statements</span><strong>{workspace.statements.length}</strong></div>
            <div className="card metric-card"><span>Transactions</span><strong>{confirmedTransactions.length}</strong></div>
            <div className="card metric-card"><span>Expense</span><strong>{money(totalByDirection(confirmedTransactions, "debit"))}</strong></div>
            <div className="card metric-card"><span>Income</span><strong>{money(totalByDirection(confirmedTransactions, "credit"))}</strong></div>
            <div className="card metric-card"><span>Unresolved</span><strong>{unresolvedCount(workspace.transactions)}</strong></div>
          </div>
        </div>
        {summaryRows.map((scope) => (
          <div key={scope.scopeLabel} className="card stack-gap">
            <div className="pane-head">
              <h3>{scope.scopeLabel}</h3>
              <span className="status-pill">{summaryMode === "monthly" ? "Monthly" : "Overall"}</span>
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

  function exportView() {
    return (
      <section className="stack-gap">
        <div className="card page-banner">
          <div className="row-wrap">
            <div>
              <p className="eyebrow">Step 05</p>
              <h3>Export</h3>
              <p className="muted">
                Choose overall or monthly export, then generate a workbook with summary, transactions,
                and adjustments.
              </p>
            </div>
            <button
              className="primary"
              disabled={busy !== "" || (exportMode === "monthly" && exportMonth === "")}
              onClick={() => void exportWorkbook()}
            >
              Export Excel
            </button>
          </div>
          <div className="detail-strip">
            <div className="detail-cell">
              <span>Mode</span>
              <strong>{exportMode}</strong>
            </div>
            <div className="detail-cell">
              <span>Month</span>
              <strong>{exportMode === "monthly" ? exportMonth || "Select month" : "All"}</strong>
            </div>
            <div className="detail-cell">
              <span>History</span>
              <strong>{workspace.exportHistory.length}</strong>
            </div>
          </div>
          <div className="export-grid">
            <label className="form-card">
              Export mode
              <select className="select-input" value={exportMode} onChange={(event) => setExportMode(event.target.value)}>
                <option value="overall">Overall</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            {exportMode === "monthly" ? (
              <label className="form-card">
                Export month
                <select className="select-input" value={exportMonth} onChange={(event) => setExportMonth(event.target.value)}>
                  <option value="">Select month</option>
                  {availableMonths.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="form-card">
              Version label
              <input value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} />
            </label>
          </div>
        </div>

        <div className="card export-card">
          <p className="eyebrow">Latest Export</p>
          <p className="export-path">{exportPath === "" ? "No export yet." : exportPath}</p>
        </div>

        <div className="card stack-gap">
          <div className="pane-head">
            <h3>Export History</h3>
            <span className="status-pill">{workspace.exportHistory.length}</span>
          </div>
          {workspace.exportHistory.length === 0 ? (
            <div className="empty-state subtle-empty">
              <p>No exports yet.</p>
            </div>
          ) : (
            workspace.exportHistory.map((item) => (
              <div key={item.id} className="summary-row">
                <span>
                  {item.export_type}
                  {item.export_month ? " / " + item.export_month : ""}
                </span>
                <strong className="export-path">{item.file_path}</strong>
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  function rulesView() {
    return appShell(
      "Rules",
      "Review, disable, edit, or delete local keyword rules.",
      <section className="rule-grid">
        {workspace.rules.length === 0 ? (
          <div className="card empty-state">
            <p>No rules yet.</p>
          </div>
        ) : (
          workspace.rules.map((rule) => (
            <article key={rule.id} className="card rule-card">
              <div className="row-wrap">
                <strong>{rule.keyword}</strong>
                <span className="status-pill">{rule.is_enabled ? "Enabled" : "Disabled"}</span>
              </div>
              <p className="muted">{rule.category}</p>
              <div className="classification-actions">
                <input
                  className="inline-input"
                  defaultValue={rule.keyword}
                  onBlur={(event) => {
                    if (event.target.value !== rule.keyword) {
                      void updateRuleRecord(rule, { keyword: event.target.value });
                    }
                  }}
                />
                <select
                  className="select-input"
                  defaultValue={rule.category}
                  onChange={(event) => void updateRuleRecord(rule, { category: event.target.value })}
                >
                  {workspace.categories.expense.concat(workspace.categories.income).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="classification-actions">
                <button
                  className="ghost"
                  onClick={() => void updateRuleRecord(rule, { is_enabled: rule.is_enabled ? 0 : 1 })}
                >
                  {rule.is_enabled ? "Disable" : "Enable"}
                </button>
                <button className="ghost" onClick={() => void deleteRuleRecord(rule.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </section>,
      <div className="page-top-actions">
        <button className="ghost" onClick={() => setScreen(activeProject ? "workspace" : "landing")}>
          {activeProject ? "Back to Project" : "Back Home"}
        </button>
        <button className="ghost language-switch" onClick={toggleLanguage}>
          {language === "zh" ? "EN" : "ZH"}
        </button>
      </div>
    );
  }

  function workspaceView() {
    let body = importView();
    if (page === "review") body = reviewView();
    if (page === "classify") body = classifyView();
    if (page === "summary") body = summaryView();
    if (page === "export") body = exportView();
    const currentTab = workflowTabs.find((tab) => tab.key === page);
    return appShell(
      activeProject ? activeProject.project_name : "Workspace",
      currentTab ? currentTab.blurb : "Project workflow",
      <>
        {workspaceHeader()}
        {body}
      </>,
      <div className="page-top-actions">
        <button className="ghost" onClick={() => setScreen("history")}>
          Project Archive
        </button>
        <button className="ghost language-switch" onClick={toggleLanguage}>
          {language === "zh" ? "EN" : "ZH"}
        </button>
      </div>
    );
  }

  if (screen === "history") return historyView();
  if (screen === "new") return newView();
  if (screen === "workspace") return workspaceView();
  if (screen === "rules") return rulesView();
  return landingView();
}
