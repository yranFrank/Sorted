# Bank Statement Local Software

## Development Baseline Document
Formal merged edition of V2 and V2.1 requirements

| Field | Value |
| --- | --- |
| Version | V2.1 |
| Document Type | Product and development baseline |
| Deployment Model | Local offline desktop software |
| Primary Platform | Windows first |
| Primary Business Use | Broker assistant bank statement review, living expense analysis, and income analysis |
| Status | Current execution baseline |

Prepared from the confirmed requirements in this conversation.

## 1. Executive Summary
This document defines the agreed development baseline for a local, offline desktop application that imports bank statements, extracts statement-level metadata and all transactions, classifies income and living expenses, supports manual review, and exports structured Excel outputs for broker workflow use.

The software is designed first for personal use and then for team use. It must support multiple Australian banks, multiple statements per customer, multiple accounts per customer, monthly and overall summary views, repeatable exports, and rule learning based on transaction keywords.

Quality priorities are strict. The product must not silently miss transactions, must not allow unresolved metadata gaps to pass forward, must not allow unresolved parsing anomalies to continue, and must keep rule learning stable and reviewable.

## 2. Product Definition
| Field | Value |
| --- | --- |
| Primary goal | Read bank statements locally, classify expense and income, support manual review, and export Excel outputs. |
| Main user at launch | Frank, then internal team colleagues. |
| Core workflow | Broker assistant living expense and income review, plus optional personal spending analysis. |
| Product scope | Generalised enough to support different users, different banks, and different use cases. |
| Platform | Windows first; Mac later. |
| Connectivity | No internet required for normal operation. |

## 3. Supported File Scope and Version Boundary
Version 1 focuses on PDF bank statements. Scanned-image statements and OCR support are deferred to Version 2.

| Area | Version 1 | Later version |
| --- | --- | --- |
| Primary input format | PDF | Retained |
| Scanned-image OCR | Not required in Version 1 | Planned in Version 2 |
| Multi-bank compatibility | Required | Expanded continuously |
| Monthly and overall summaries | Required | Retained |

Priority banks include CBA, ANZ, NAB, Westpac, Bank of Melbourne, ING, BOQ, and other common Australian banks.

## 4. Project Structure Model
A project represents one customer. A single project can hold multiple statements and can be exported multiple times.

| Entity | Rule |
| --- | --- |
| Project | One project corresponds to one customer. |
| Statements per project | A project can contain multiple statements. |
| Accounts per project | A project can include multiple accounts for the same customer. |
| Periods per project | A project can include multiple statements for one account across multiple months. |
| Export behaviour | A project can be exported repeatedly and must keep export history. |
| History behaviour | A project must be re-openable and continue editing from prior state. |

## 5. Statement Import and Merge Rules
The system must support importing multiple statements in two confirmed merge scenarios.

| Scenario | Description |
| --- | --- |
| Same customer, multiple accounts | Statements from different accounts owned by the same customer can be combined into one project for unified review. |
| Single account, multiple statements | Sequential statements from one account, such as January, February, and March, can be combined into one project for consolidated review. |

When multiple statements are linked to one project, the application must support both overall aggregation and month-by-month breakdown. Category totals must aggregate confirmed transactions only, and income and expense must always be separated.

## 6. Mandatory Extraction Requirements

### 6.1 Statement-level required fields
| Field | Requirement |
| --- | --- |
| Bank name | Must be read or manually completed before continuing. |
| Statement start date | Must be read or manually completed before continuing. |
| Statement end date | Must be read or manually completed before continuing. |
| Customer name | Must be read or manually completed before continuing. |
| Account name | Must be read or manually completed before continuing. |
| Account number | Must be read or manually completed before continuing. |
| BSB | Must be read or manually completed before continuing. |
| Statement issue date | Must be read or manually completed before continuing. |
| Currency | Not important for Version 1. |

### 6.2 Transaction-level required fields
| Field | Requirement |
| --- | --- |
| Date | Required |
| Description | Required and retained internally even if hidden in export |
| Amount | Required |
| Debit / credit direction | Required |
| Balance | Required where present on statement |
| Transaction reference | Required |
| Channel | Required where available, for example POS, transfer, ATM, direct debit |
| Raw text | Retained internally for review and traceability |

## 7. Core Parsing and Validation Rules
The primary product rule is zero silent omission of transactions. The system must prefer over-capturing and routing uncertain items to review rather than dropping them.

| Rule | Implementation expectation |
| --- | --- |
| No silent omission | Transactions must not be skipped without explicit review status. |
| Metadata gate | If statement-level mandatory fields are missing, the user cannot proceed until they are completed. |
| Transaction anomaly gate | If a transaction has parsing issues or unresolved category status, it must enter Needs Review and must be manually resolved before proceeding. |
| Classification failure is not extraction failure | A transaction may be uncategorised, but it must still exist in the extracted dataset. |

To prove that extraction is complete, the interface must provide both extraction statistics and raw-document comparison. The review screen should show the original statement preview alongside the extracted transaction list, with highlighting or marking of successfully read transactions.

## 8. Classification Baseline

### 8.1 Expense categories
| Category | Scope notes |
| --- | --- |
| Grocery + eating out | Groceries and eating out combined |
| Insurance | Includes car insurance, building insurance for owner occupied use, and estimated new purchase owner occupied insurance items |
| Health insurance | Separate from general insurance |
| Transport | Includes rego, petrol, and Myki |
| Bills + council rate | General bills and council rates |
| Body corp | Strata or body corporate expenses |
| Entertainment | Entertainment spending |
| Medical | Medical expenses |
| Cloth + shopping | Clothing and general shopping |
| Internet / phone | Internet and phone expenses |
| Education | Education-related expenses |
| Other (Raise concern) | Other spending that may need attention or concern marking |

### 8.2 Income categories
| Category | Scope notes |
| --- | --- |
| PAYG income | Employment PAYG income |
| Cash deposit | Cash deposits treated as income-classified inflow |
| Interest income | Bank interest and related income |

### 8.3 Handling unidentified items
For unidentified or uncertain transactions, the user must be able to manually choose a category, create a new category, mark the item as ignored, mark it as transfer, mark it as pending, or apply a keyword-based rule to all similar transactions such as Coles, CWH, or transfer patterns.

## 9. Rule Learning and Rule Management
Version 1 uses merchant keyword matching as the primary memory and automation mechanism. More advanced matching, such as exact merchant-name matching and amount-plus-description matching, is deferred to later versions.

| Capability | Version 1 status |
| --- | --- |
| Keyword-based rules | Required |
| Rule apply-to-similar | Required |
| Rule management page | Required |
| Edit existing rule | Required |
| Delete existing rule | Required |
| Enable or disable rule | Recommended |
| Exact merchant matching | Future enhancement |
| Amount + description combined logic | Future enhancement |

## 10. Page Flow and Interface Baseline
| Stage | Page or function | Key purpose |
| --- | --- | --- |
| 1 | Landing Page | Entry point, product identity, and Start action |
| 2 | Import Statement Page | Import statements as cards, preview source files, manage selected statements |
| 3 | Parse / Review Page | Validate statement metadata, compare original file with extracted transactions, resolve anomalies |
| 4 | Classification Page | Review identified and unidentified transactions and apply category actions |
| 5 | Summary Page | Review category totals, proportions, date range, and unresolved counts |
| 6 | Export | Choose export mode and enter adjusted totals before file generation |

Interface style must be minimal, professional, and light-business in tone. The application must support Chinese and English language switching.

## 11. Layout Requirements by Page

### 11.1 Import Statement Page
- Statements displayed as cards.
- Clicking a card opens a scrollable preview modal for the full file.
- Useful card metadata should include file name, bank name, date range, parsing status, and review count.

### 11.2 Parse / Review Page
- Original file preview must be visible.
- Extracted results must be visible side by side or in tightly linked review layout.
- Statement metadata must be shown and manually editable when missing.
- Highlighted or marked transactions should indicate what has been successfully read.

### 11.3 Classification Page
- Left: original file transaction list.
- Middle: identified transactions.
- Right: unidentified transactions.
- Below: action list and batch operation controls.
- Lower section: summary preview.

### 11.4 Summary Page
- Must prioritise category proportions, category details, date range, and unresolved-item counts.
- Must separate income and expense.
- Must support overall view and monthly view.

## 12. Summary Logic
Summary must support two display modes and the same logic must be reflected during export.

| Mode | Behaviour |
| --- | --- |
| Overall | Show project-wide combined data across all linked statements, with total income, total expense, category totals, proportions, unresolved counts, and full date span. |
| Monthly | Show data broken down by month, including monthly income, monthly expense, category totals by month, unresolved counts by month, and anomaly counts by month. |

The user must be able to choose between overall and monthly summary views. Recommended interface patterns include tabs, dropdown view mode selection, or a clear toggle such as All / Monthly or 总览 / 按月.

## 13. Adjusted Totals Workflow
Adjusted totals are entered before Excel export, not during routine classification.

| Field | Rule |
| --- | --- |
| Original total | System-generated by category and scope |
| Adjusted total | User-entered; required for each category during adjustment workflow |
| Adjustment note | Optional but supported |
| Scope | Must support both overall scope and monthly scope |

Because overall and monthly reporting are both required, the adjustment model must support project-level overall adjustments and month-specific adjustments for each category.

## 14. Export Baseline
A project can be exported multiple times. Export history must be retained, including export mode, time, file path, and version label where applicable.

### 14.1 Required export contents
- Customer name
- Account number
- Date
- Bank name
- Total of each category
- Adjusted total for each category

### 14.2 Export mode rules
| Export mode | Contents |
| --- | --- |
| Overall export | Combined totals across all linked statements in the selected project. |
| Monthly export | Month-by-month breakdown of totals, category results, and adjusted totals. |

### 14.3 Transaction export fields
Final exported transaction rows should contain only date, category, status or mark, and amount. Original descriptions remain stored internally but are hidden from final exported transaction sheets.

### 14.4 Suggested workbook structure
| Sheet | Purpose |
| --- | --- |
| Statement Info | Customer and statement metadata such as customer name, bank name, account number, and period information. |
| Transactions | Filtered transaction output containing date, category, status, and amount. |
| Summary | Category totals, income and expense separation, and either overall or monthly breakdown depending on export mode. |
| Adjustments | Optional dedicated sheet showing original totals, adjusted totals, and adjustment notes. |

## 15. History and Persistence Requirements
| Area | Requirement |
| --- | --- |
| Project history | Must exist and show previously handled projects. |
| Re-open and continue editing | Required. |
| Manual correction retention | Required. |
| Export history retention | Required. |
| Rule memory retention | Required. |
| User-defined categories | Must be retained locally. |

## 16. Data Model Baseline

### 16.1 Project
- id, customer_name, project_name, status, created_at, updated_at, last_opened_at

### 16.2 Statement
- id, file_name, file_path, bank_name, customer_name, account_name, account_number, bsb, statement_issue_date, statement_start_date, statement_end_date, parse_status, metadata_status, created_at, updated_at

### 16.3 Project-statement link
- id, project_id, statement_id, account_name, account_number, statement_start_date, statement_end_date

### 16.4 Transaction
- id, statement_id, date, description, amount, debit_credit, balance, transaction_reference, channel, category, status, reviewed_flag, raw_text, created_at, updated_at

### 16.5 Rule
- id, keyword, category, match_type, priority, is_enabled, created_at, updated_at

### 16.6 Adjustment
- id, project_id, category, scope_type, scope_month, original_total, adjusted_total, note, created_at, updated_at

### 16.7 Export history
- id, project_id, export_type, export_month, file_path, exported_at, version_label

## 17. Non-functional Requirements
| Area | Requirement |
| --- | --- |
| Operation mode | Fully local and offline during normal use. |
| Platform | Windows first. |
| Language | Chinese and English toggle required. |
| Performance target | Must support at least six months of bank statements per project. |
| Design style | Minimal, professional, light business aesthetic. |

## 18. Quality Red Lines
The following failures are explicitly unacceptable and should be treated as quality red lines during development and testing:

- Missing transactions during extraction
- Incorrect classification results
- Incorrect export output
- Confused or unstable rule memory

These items should drive both automated tests and manual acceptance checks.

## 19. Recommended Technical Stack
| Layer | Recommendation | Rationale |
| --- | --- | --- |
| Desktop shell | Electron + React + TypeScript | Best fit for Windows-first local desktop software with complex review and table-based UI. |
| Local database | SQLite | Simple, durable, offline storage for projects, statements, transactions, rules, exports, and adjustments. |
| Primary parser target | PDF statement parser | Version 1 priority. |
| Image OCR | Deferred | Move to Version 2 to reduce Version 1 complexity. |
| Excel export | Structured workbook generator | Needed for summary, transaction, and adjustment outputs. |

## 20. Delivery and Acceptance Criteria
| Acceptance area | Minimum condition |
| --- | --- |
| Statement metadata gate | User cannot continue until all required metadata is present or manually completed. |
| Transaction review gate | User cannot continue until parsing anomalies and unresolved review items are handled. |
| Summary modes | Overall and monthly modes both operate correctly. |
| Export modes | Overall and monthly exports both operate correctly and match summary logic. |
| History behaviour | Projects can be reopened and continue editing. |
| Rule management | Keyword rules can be reviewed, edited, and removed. |

## Appendix A. Confirmed Category Sets
Expense categories
- Grocery + eating out
- Insurance
- Health insurance
- Transport
- Bills + council rate
- Body corp
- Entertainment
- Medical
- Cloth + shopping
- Internet / phone
- Education
- Other (Raise concern)

Income categories
- PAYG income
- Cash deposit
- Interest income

## Appendix B. Final Notes for Development Kick-off
This document reflects the merged and confirmed baseline of the requirements provided in the conversation. It should be treated as the current working specification for planning, UI design, data modelling, parser design, rule engine setup, and export design. Any later changes should be tracked as versioned requirement updates rather than informal edits.
