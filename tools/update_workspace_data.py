      FOREIGN KEY(statement_id) REFERENCES statements(id)> 
    ); 
  `);''' 
if old_migrate not in text: raise SystemExit('migrate block not found') 
text = text.replace(old_migrate, new_migrate) 
 
old_list = '''export function listStatementsByProject(projectId: string): StatementRecord[] { 
  const db = getDatabase(); 
  return db.prepare(` 
    SELECT * 
    FROM statements 
    WHERE project_id = ? 
    ORDER BY created_at ASC 
  `).all(projectId) as StatementRecord[]; 
} 
''' 
new_list = '''export function listStatementsByProject(projectId: string): StatementRecord[] { 
  const db = getDatabase(); 
  return db.prepare(` 
    SELECT 
      s.*, 
      r.page_count, 
      r.raw_text, 
      r.parsed_at, 
      COUNT(t.id) AS transaction_count, 
      COALESCE(SUM(CASE WHEN t.status = 'needs_review' THEN 1 ELSE 0 END), 0) AS unresolved_count 
    FROM statements s 
    LEFT JOIN statement_parse_results r ON r.statement_id = s.id 
    LEFT JOIN transactions t ON t.statement_id = s.id 
    WHERE s.project_id = ? 
    GROUP BY s.id 
    ORDER BY s.created_at ASC 
  `).all(projectId) as StatementRecord[]; 
} 
 
export function getProjectWorkspace(projectId: string) { 
  const db = getDatabase(); 
  const project = db.prepare(` 
    SELECT * 
    FROM projects 
    WHERE id = ? 
  `).get(projectId); 
 
  const statements = listStatementsByProject(projectId); 
  const transactions = db.prepare(` 
    SELECT 
      t.*, 
      s.file_name, 
      s.bank_name, 
      s.account_name, 
      s.statement_start_date, 
      s.statement_end_date 
    FROM transactions t 
    INNER JOIN statements s ON s.id = t.statement_id 
    WHERE s.project_id = ? 
    ORDER BY t.date ASC, t.created_at ASC 
  `).all(projectId); 
 
  return { project, statements, transactions }; 
} 
''' 
if old_list not in text: raise SystemExit('listStatementsByProject block not found') 
text = text.replace(old_list, new_list) 
 
path.write_text(text, encoding='utf-8') 
print('updated database.ts') 
