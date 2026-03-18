$c = Get-Content 'src\main\database.ts'
$c[298] = '  db.exec(''CREATE TABLE IF NOT EXISTS statement_parse_results (statement_id TEXT PRIMARY KEY, page_count INTEGER NOT NULL, raw_text TEXT NOT NULL, parsed_at TEXT NOT NULL, FOREIGN KEY(statement_id) REFERENCES statements(id))'');'
$c[299] = '  db.prepare(''INSERT INTO statement_parse_results (statement_id, page_count, raw_text, parsed_at) VALUES (?, ?, ?, ?) ON CONFLICT(statement_id) DO UPDATE SET page_count = excluded.page_count, raw_text = excluded.raw_text, parsed_at = excluded.parsed_at'').run(input.statementId, input.pageCount, input.rawText, timestamp);'
$c[300] = '  db.prepare(''UPDATE statements SET parse_status = ?, updated_at = ? WHERE id = ?'').run(''parsed'', timestamp, input.statementId);'
$c[301] = '  return db.prepare(''SELECT s.*, r.page_count, r.raw_text, r.parsed_at FROM statements s LEFT JOIN statement_parse_results r ON r.statement_id = s.id WHERE s.id = ?'').get(input.statementId);'
Set-Content 'src\main\database.ts' $c
